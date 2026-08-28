// After the infographic is generated, ask a vision model to locate each labeled component's
// shape on the cutaway so the topic screen can overlay tappable regions (ZoomableImage
// hotspots). Best-effort: every call site treats a failure as "no hotspots", never fatal --
// the image and the component list are already useful on their own.

import { encode } from 'base64-arraybuffer';
import { z } from 'zod';

import { askVisionJson } from '@/lib/ai/vision';
import { logger } from '@/lib/logger';
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

  // silent: a hotspot failure is best-effort -- detectAndStoreHotspots logs its own line.
  const raw = await askVisionJson(
    'hotspots',
    prompt,
    { base64, contentType: image.contentType },
    { silent: true }
  );

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
