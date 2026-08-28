// After the infographic is generated, ask a vision model to locate each labeled component's
// shape on the cutaway so the topic screen can overlay tappable regions (ZoomableImage
// hotspots). Best-effort: every call site treats a failure as "no hotspots", never fatal --
// the image and the component list are already useful on their own.

import { encode } from 'base64-arraybuffer';
import { z } from 'zod';

import { throwCleanApiError } from '@/lib/ai/errors';
import { logger } from '@/lib/logger';
import { getLlmProvider } from '@/state/settings-store';
import { ComponentBoundingBox } from '@/types/knowledge';

export interface HotspotImage {
  bytes: ArrayBuffer;
  contentType: string;
}

const BoxSchema = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
const BoxesSchema = z.object({ boxes: z.array(BoxSchema) });

function buildPrompt(componentNames: string[]): string {
  return (
    'This image is a technical cutaway infographic with numbered callouts. For each component ' +
    'named below, return the bounding box of that part *on the central cutaway illustration* ' +
    '(the physical shape itself, not its callout number, not its text label, and not anything ' +
    'in the side panels). Coordinates are normalized 0-1 with the origin at the top-left of ' +
    'the whole image. Omit any component you cannot confidently locate rather than guessing. ' +
    'Respond with JSON only: {"boxes":[{"name","x","y","width","height"}]}.\n\nComponents:\n' +
    componentNames.map((n) => `- ${n}`).join('\n')
  );
}

/**
 * Returns a name -> bbox map for whichever components the model could place. Names are matched
 * back to the caller's list case-insensitively; unrecognized names and out-of-range boxes are
 * dropped. Follows the selected LLM provider (all three have vision).
 */
export async function detectComponentHotspots(
  image: HotspotImage,
  componentNames: string[]
): Promise<Map<string, ComponentBoundingBox>> {
  if (componentNames.length === 0) return new Map();

  const base64 = encode(image.bytes);
  const prompt = buildPrompt(componentNames);
  const provider = getLlmProvider();

  let raw: unknown;
  if (provider === 'anthropic') raw = await detectWithAnthropic(prompt, base64, image.contentType);
  else if (provider === 'gemini') raw = await detectWithGemini(prompt, base64, image.contentType);
  else raw = await detectWithOpenAI(prompt, base64, image.contentType);

  const parsed = BoxesSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('hotspots', 'Vision response failed schema validation', { raw });
    return new Map();
  }

  const wanted = new Map(componentNames.map((n) => [n.toLowerCase(), n]));
  const result = new Map<string, ComponentBoundingBox>();
  for (const box of parsed.data.boxes) {
    const canonical = wanted.get(box.name.trim().toLowerCase());
    if (!canonical) continue;
    const bbox = clampBox(box);
    if (bbox) result.set(canonical, bbox);
  }
  return result;
}

const MIN_HOTSPOT_SIZE = 0.01;

/**
 * Normalizes one model-supplied box to a safe `ComponentBoundingBox` fully inside the 0-1
 * frame: the origin is clamped and the width/height are trimmed to the remaining space.
 * Returns null for a degenerate result (either dimension collapses below ~1% of the image).
 * Exported for unit testing.
 */
export function clampBox(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): ComponentBoundingBox | null {
  const x = clamp01(box.x);
  const y = clamp01(box.y);
  const width = clamp01(Math.min(box.width, 1 - x));
  const height = clamp01(Math.min(box.height, 1 - y));
  if (width < MIN_HOTSPOT_SIZE || height < MIN_HOTSPOT_SIZE) return null;
  return { x, y, width, height };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

async function detectWithOpenAI(prompt: string, base64: string, contentType: string): Promise<unknown> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY is required for hotspot detection');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.EXPO_PUBLIC_OPENAI_TEXT_MODEL ?? 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}` } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) await throwCleanApiError('hotspots', 'OpenAI', response, { silent: true });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return content ? JSON.parse(content) : null;
}

async function detectWithAnthropic(prompt: string, base64: string, contentType: string): Promise<unknown> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY is required for hotspot detection');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.EXPO_PUBLIC_ANTHROPIC_TEXT_MODEL ?? 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${prompt}\n\nReturn only the raw JSON object.` },
            {
              type: 'image',
              source: { type: 'base64', media_type: contentType, data: base64 },
            },
          ],
        },
      ],
    }),
  });
  if (!response.ok) await throwCleanApiError('hotspots', 'Anthropic', response, { silent: true });

  const data = await response.json();
  const text = (data.content as { type: string; text?: string }[])?.find((b) => b.type === 'text')?.text;
  return text ? JSON.parse(extractJson(text)) : null;
}

async function detectWithGemini(prompt: string, base64: string, contentType: string): Promise<unknown> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is required for hotspot detection');

  const model = process.env.EXPO_PUBLIC_GEMINI_TEXT_MODEL ?? 'gemini-flash-latest';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: contentType, data: base64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!response.ok) await throwCleanApiError('hotspots', 'Gemini', response, { silent: true });

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? JSON.parse(text) : null;
}

/** Anthropic sometimes wraps JSON in prose or a ```json fence despite the instruction. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}
