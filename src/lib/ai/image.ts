import { decode } from 'base64-arraybuffer';

import { GeneratedKnowledge } from './llm';
import { throwCleanApiError } from '@/lib/ai/errors';
import { getImageProvider } from '@/state/settings-store';

export interface GeneratedImage {
  bytes: ArrayBuffer;
  contentType: string;
}

const RENDERING_STYLE = `RENDERING STYLE (all must apply simultaneously)
- Ultra-detailed photorealistic architectural/product visualization quality, rendered at the \
level of detail and material realism of a professional architectural visualization studio -- \
not a simplified, flat, or schematic-looking diagram
- Technical engineering illustration, BIM/CAD-inspired visualization
- High-detail 3D cutaway render
- Engineering textbook aesthetic, museum-quality educational graphic
- Physically based rendering (PBR) materials -- realistic, neutral, non-saturated colors
- Clean white studio background, clean neutral lighting, no gradients, no scenery, no people, \
no dramatic or cinematic lighting, no concept-art aesthetic
- Prioritize clarity over artistic style: everything must look technically plausible and \
physically accurate, not stylized or decorative
- No mathematical formulas, equations, or symbolic/algebraic notation anywhere in the image
Style keywords: architectural cutaway, engineering infographic component, technical \
illustration, museum exhibit graphic, BIM visualization, CAD rendering, isometric cutaway, \
photorealistic PBR, engineering textbook, structural visualization.`;

const CAMERA = `CAMERA
Large architectural cutaway viewed from a slightly elevated three-quarter isometric \
perspective, approximately 25° downward, front-left corner view, showing both the exterior \
and interior structural systems simultaneously, with minimal perspective distortion.`;

const LAYOUT = `LAYOUT -- two zones only, nothing else
LEFT/CENTER ZONE (roughly 70% of canvas width): the large labeled 3D cutaway illustration \
described below. This is the dominant visual element, positioned left-of-center so the right \
column has room.

RIGHT COLUMN (a narrow strip, roughly 30% of canvas width, plain white background, thin \
ruled divider from the cutaway zone, no other border/card needed): exactly two stacked \
panels, top to bottom:
1. A "MATERIALS" panel: small bold dark-navy caps header, then a compact vertical list, each \
row a small solid material-color swatch next to a short label (material name + spec).
2. A "CONSTRUCTION SEQUENCE" panel directly below it: small bold dark-navy caps header, then \
a numbered vertical list of short step names, each with its own small outlined numbered \
circle -- visually distinct from the cutaway's filled navy component markers, so the two \
numbering systems are never confused with each other.
Nothing else appears in the right column, and nothing appears above, below, or around these \
two zones (no title, no other panels, no footer).`;

/**
 * Grounds the generic texture guidance in this topic's actual materials (from the knowledge
 * base) rather than leaving the model to guess -- e.g. "Concrete (3000-4000 PSI)" tells it
 * specifically what the poured surface should look like. The same list doubles as the content
 * for the on-image MATERIALS panel (see LAYOUT), so the panel's swatches and the cutaway's own
 * surfaces are required to visually match.
 */
function buildMaterialRealism(materials: GeneratedKnowledge['materials']): string {
  const materialList = materials.map((m) => `- ${m.name} (${m.spec})`).join('\n');
  return `MATERIAL REALISM -- this is what separates a professional render from a toy diagram
Render every visible surface on the cutaway with its real, distinct material texture and \
color -- never a flat, generic gray or single-tone shape. This subject's actual materials are:
${materialList}
Use this list for two things: (1) informing each surface's real-world texture and color on \
the cutaway itself -- individual wood grain on framing members, a rough poured-concrete \
surface, loose individual stones in gravel, visible layered striation in soil/backfill, a \
matte rubber or polymer sheen on membranes, a visible foam-cell texture on rigid insulation, \
brushed or galvanized metal on fasteners/hardware/rebar, distinct siding/cladding texture; \
and (2) the content of the MATERIALS panel described in LAYOUT below -- each swatch color \
must match how that material actually looks on the cutaway. Show the full surrounding \
context needed to understand the assembly (e.g. adjoining structure, surrounding ground) in \
the same richness of detail as the subject itself.`;
}

function buildConstructionSequence(construction: GeneratedKnowledge['construction']): string {
  return construction
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step) => `${step.order}. ${step.title}`)
    .join('\n');
}

const CONTENT_RULES = `WHAT NOT TO INCLUDE -- this is a hard requirement
Only the cutaway and the two panels described in LAYOUT belong in this image. Everything else \
about this topic (full description, key features, dimensions, how-it-works explanation, \
failure modes, related topics, trivia) is already shown elsewhere in the app's own UI, so none \
of it belongs here. Do NOT render:
- A title, headline, subtitle, or any text banner
- A "key features", "at a glance", "typical dimensions", or "common loads" panel
- A "how it works" / engineering-principle panel, or any formulas or equations
- A "potential issues" / failure-modes panel
- A "foundation/system types" comparison panel
- A "related systems" panel, an "interactive explanation" panel, or a "did you know" footer
- Any panel, box, sidebar, or block of paragraph text beyond the two panels in LAYOUT`;

const TEXT_RULES = `LABEL RULES
- On the cutaway: small numbered markers, each connected by a thin leader line to a short \
component name (2-4 words) placed just outside the illustration edge.
- In the MATERIALS and CONSTRUCTION SEQUENCE panels: the short list text described in LAYOUT.
- All on-image text MUST be in clear, legible English, set in a clean technical sans-serif font.
- Never render invented characters, garbled glyphs, or any non-English language.`;

/**
 * Builds a prompt for a labeled 3D cutaway illustration plus two panels that pair visually
 * with it (materials, construction sequence) -- no title and no other panels. Everything else
 * about the topic (full description, engineering principle, failure modes, related topics)
 * already has its own tab in the app UI, so it's left out of the image entirely.
 */
function buildInfographicPrompt(knowledge: GeneratedKnowledge): string {
  const calloutList = knowledge.components
    .map((c, i) => `${i + 1}. ${c.name} — ${c.does}`)
    .join('\n');

  const numberingRules = `NUMBERING INTEGRITY -- this is a hard requirement
- Every one of the ${knowledge.components.length} components listed below must be labeled on \
the cutaway -- do not omit any, and do not add labels for anything not in this list.
- Marker numbers 1 through ${knowledge.components.length} must each appear exactly once on the \
cutaway, with no duplicate or repeated numbers anywhere in the image.
- Each marker connects via exactly one straight, non-crossing leader line to exactly one label.
- Copy each label's name text exactly as given below, verbatim -- do not paraphrase, \
abbreviate, merge multiple components into a single label, or misspell any word.
- The construction sequence panel's own step numbers are a separate numbering system from the \
cutaway's component markers; do not mix the two.`;

  return `Create a highly detailed, technically accurate 3D cutaway illustration of: \
${knowledge.imagePrompt}

Cut away surrounding material/context so the complete internal assembly is visible. The \
illustration should be technically understandable rather than decorative.

${CAMERA}

${LAYOUT}

${buildMaterialRealism(knowledge.materials)}

CONSTRUCTION SEQUENCE panel content (step number, name only):
${buildConstructionSequence(knowledge.construction)}

Number and label these components directly on the cutaway with small navy numbered markers \
and thin leader lines; each callout is just the component name, nothing else:
${calloutList}

${numberingRules}

${CONTENT_RULES}

${TEXT_RULES}

${RENDERING_STYLE}

Landscape composition.`;
}

export async function generateImage(knowledge: GeneratedKnowledge): Promise<GeneratedImage> {
  const provider = getImageProvider();
  const prompt = buildInfographicPrompt(knowledge);
  if (provider === 'openai') return generateWithOpenAI(prompt);
  if (provider === 'gemini') return generateWithGemini(prompt);
  throw new Error(`Unsupported image provider: ${provider}`);
}

async function generateWithOpenAI(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY is required when IMAGE_PROVIDER=openai');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.EXPO_PUBLIC_OPENAI_IMAGE_MODEL ?? 'gpt-image-1',
      prompt,
      // gpt-image-1 has no true 16:9 option; 1536x1024 (3:2) is the closest landscape size.
      size: '1536x1024',
      quality: 'high',
    }),
  });

  if (!response.ok) {
    await throwCleanApiError('image', 'OpenAI (image generation)', response);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data');

  return { bytes: decode(b64), contentType: 'image/png' };
}

async function generateWithGemini(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is required when IMAGE_PROVIDER=gemini');

  // Imagen's :predict endpoint shuts down 2026-08-17; Google's replacement ("Nano Banana")
  // family is reached through :generateContent, returning the image as inlineData on a
  // response part rather than predictions[].bytesBase64Encoded. Defaults to Gemini 3 Pro Image
  // ("Nano Banana Pro") over the cheaper/faster 2.5 Flash tier -- its text/label rendering is
  // materially more accurate, which matters here since every callout on the cutaway is on-image
  // text; override via EXPO_PUBLIC_GEMINI_IMAGE_MODEL to trade quality back for cost/latency.
  const model = process.env.EXPO_PUBLIC_GEMINI_IMAGE_MODEL ?? 'gemini-3-pro-image-preview';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '16:9', imageSize: '2K' },
        },
      }),
    }
  );

  if (!response.ok) {
    await throwCleanApiError('image', 'Google Gemini (image generation)', response);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts as
    | { inlineData?: { data?: string; mimeType?: string } }[]
    | undefined;
  const inlineData = parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!inlineData?.data) throw new Error('Gemini returned no image data');

  return { bytes: decode(inlineData.data), contentType: inlineData.mimeType ?? 'image/png' };
}
