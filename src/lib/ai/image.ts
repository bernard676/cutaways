import { decode } from 'base64-arraybuffer';

import { GeneratedKnowledge } from './llm';
import { throwCleanApiError } from '@/lib/ai/errors';
import { getImageProvider } from '@/state/settings-store';

export interface GeneratedImage {
  bytes: ArrayBuffer;
  contentType: string;
}

// Resolved once at module load and reused both in the API calls below and by the settings
// screen, so the UI can never show a model name that drifts from what's actually requested.
export const OPENAI_IMAGE_MODEL = process.env.EXPO_PUBLIC_OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
export const GEMINI_IMAGE_MODEL =
  process.env.EXPO_PUBLIC_GEMINI_IMAGE_MODEL ?? 'gemini-3-pro-image-preview';

const ROLE = `ROLE
You are an architectural illustrator and museum exhibit designer producing one page of a \
museum-quality educational engineering infographic series -- the kind found in an advanced \
civil/mechanical engineering textbook or a science museum's exhibit graphics. This is NOT a \
product render. This is NOT concept art. This is NOT an isolated exploded-CAD parts diagram \
floating in empty space. Think "editorial infographic page," not "CAD screenshot": a \
confident, large-scale hero illustration with real information density around it, not a \
small product shot with a couple of labels.`;

const STYLE = `STYLE
- Museum-quality educational engineering infographic -- editorial/architectural publication \
quality, the visual language of a printed textbook page or exhibit panel, not a 3D-modeling \
portfolio render
- Ultra-detailed photorealistic architectural visualization, rendered at the level of detail \
and material realism of a professional architectural visualization studio
- Technical engineering illustration, BIM/CAD-inspired accuracy, but presented as a finished \
editorial page, not a bare CAD viewport
- Physically based rendering (PBR) materials -- realistic, neutral, non-saturated colors, \
every component physically accurate
- High information density: this page should read as dense and informative at a glance, not \
sparse or minimal
- Clean white background, dark navy headings, clean neutral lighting, no gradients, no \
scenery, no people, no cinematic or dramatic lighting, no concept-art aesthetic
- Prioritize clarity, education, and engineering accuracy over artistic style -- everything \
must look technically plausible, not stylized or decorative
- No mathematical formulas, equations, or symbolic/algebraic notation anywhere in the image
Style keywords: museum exhibit graphic, engineering textbook page, editorial infographic, \
architectural cutaway, technical illustration, BIM visualization, isometric cutaway, \
photorealistic PBR, structural visualization.`;

const LAYOUT = `LAYOUT -- two zones only, nothing else
This is a page layout, not a single floating object: fill the canvas with confident, \
magazine-spread composition, generous but not empty white space, and a clear modular grid.

LEFT/CENTER ZONE (roughly 70% of canvas width): one dominant hero illustration -- the large \
labeled 3D cutaway described below. It should feel like the centerpiece of a textbook spread: \
large, confidently framed, and rich with visible detail, not a small object adrift in empty \
white space.

RIGHT COLUMN (a narrow strip, roughly 30% of canvas width, plain white background, thin \
ruled divider from the cutaway zone): exactly two stacked panels, top to bottom:
1. A "MATERIALS" panel: small bold dark-navy caps header, then a compact vertical list, each \
row a small solid material-color swatch next to a short label (material name + spec).
2. A "CONSTRUCTION SEQUENCE" panel directly below it: small bold dark-navy caps header, then \
a numbered vertical list of short step names, each with its own small outlined numbered \
circle -- visually distinct from the cutaway's filled navy component markers, so the two \
numbering systems are never confused with each other.
Nothing else appears in the right column, and nothing appears above, below, or around these \
two zones (no title, no other panels, no footer).`;

const CAMERA = `CAMERA
Large architectural cutaway viewed from a slightly elevated three-quarter isometric \
perspective, approximately 25° downward, front-left corner view, showing both the exterior \
and interior structural systems simultaneously, with minimal perspective distortion.`;

const GRAPHIC_DESIGN = `GRAPHIC DESIGN
- Consistent modular grid, consistent margins, consistent spacing throughout
- Thin vector-style leader lines, solid navy numbered markers
- White page background, muted engineering color palette (navy, charcoal, warm neutrals from \
the real materials -- no bright saturated accent colors)
- Panel headers are small bold dark-navy caps with a thin rule beneath them
- Everything aligned to the grid -- no loose, randomly placed elements`;

const TYPOGRAPHY = `TYPOGRAPHY
- Panel headers ("MATERIALS", "CONSTRUCTION SEQUENCE"): bold, dark navy, small caps
- Callout component names: bold black
- Callout descriptions and panel list body text: regular weight, muted gray
- One consistent, modern, professional sans-serif typeface family throughout -- no decorative \
or mismatched fonts, no serif fonts
- Clear size hierarchy (headers > names > descriptions) so the page is scannable at a glance`;

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

const CALLOUT_FORMAT = `CALLOUT FORMAT -- match this exactly, it's the core of the image
Each callout is a small solid navy circle containing a white number, placed directly on its \
component on the cutaway. A thin leader line (straight, or a single clean bend) runs from the \
marker out to a two-line label positioned in a column just outside the illustration's left or \
right edge:
- Line 1: the component name in bold black text.
- Line 2, directly beneath it: a short muted-gray description, one line, under 10 words.
Distribute callouts evenly between a left column and a right column (roughly half on each \
side, whichever side is physically closer to that component), each column's labels stacked \
top-to-bottom in reading order with even vertical spacing -- not clustered, not overlapping.`;

const TEXT_RULES = `LABEL RULES
- On the cutaway: the numbered callouts described in CALLOUT FORMAT below.
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
- Each marker connects via exactly one non-crossing leader line to exactly one two-line label.
- Copy each label's name (line 1) exactly as given below, verbatim -- do not paraphrase, \
abbreviate, merge multiple components into a single label, or misspell any word. The \
description (line 2) may be shortened to fit, but must stay accurate to the text given.
- The construction sequence panel's own step numbers are a separate numbering system from the \
cutaway's component markers; do not mix the two.`;

  return `${ROLE}

${STYLE}

${LAYOUT}

${CAMERA}

${GRAPHIC_DESIGN}

${TYPOGRAPHY}

SUBJECT
Create a highly detailed, technically accurate 3D cutaway illustration of: \
${knowledge.imagePrompt}
Cut away surrounding material/context so the complete internal assembly is visible. The \
illustration should be technically understandable rather than decorative.

${buildMaterialRealism(knowledge.materials)}

CONSTRUCTION SEQUENCE panel content (step number, name only):
${buildConstructionSequence(knowledge.construction)}

${CALLOUT_FORMAT}

Components to callout on the cutaway (name — description):
${calloutList}

${numberingRules}

${CONTENT_RULES}

${TEXT_RULES}

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
      model: OPENAI_IMAGE_MODEL,
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
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
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
