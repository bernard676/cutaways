// The "scan an object" entry point: the user photographs something, and a vision model names
// it so the existing search -> knowledge -> infographic pipeline can run on that name. Follows
// the selected LLM provider (all three have vision) via askVisionJson.

import { z } from 'zod';

import { logger } from '@/lib/logger';
import { askVisionJson } from '@/lib/ai/vision';

export interface IdentifiedSubject {
  /**
   * The canonical, encyclopedia-style name to search for (e.g. "suspension bridge", "disc
   * brake caliper"). `null` when the photo has no subject this app can explain.
   */
  label: string | null;
  /** A slightly fuller human-readable description shown while generating, if the model gave one. */
  detail: string | null;
  /** Other plausible identifications, best-first, for a "not quite right?" affordance. */
  alternatives: string[];
}

const PROMPT = `You are the visual identification step of Sketch Studios, a visual encyclopedia \
of how physical things work (objects, structures, machines, mechanisms, tools, vehicles, \
biological systems, technical concepts).

Look at the photo and identify the single most prominent such subject in it. Respond with the \
canonical name a reference book would use and that a user would type into a search box \
- e.g. "suspension bridge", "turbofan engine", "disc brake caliper", "centrifugal pump", \
"human heart", "ball bearing".

Rules:
- Prefer the specific over the generic when you are confident ("turbofan engine", not "engine"), \
but never guess a manufacturer, model number, or product name.
- If the main subject is a person, an animal as a whole, a landscape, a screenshot, a document \
or page of text, a meal, artwork, or anything too blurry/ambiguous to name, set "label" to null.
- "detail" is an optional one-line elaboration (materials, type, or context you can see); null if none.
- "alternatives" is 0-4 other names it might be, best guess first.

Respond with JSON only: {"label": string | null, "detail": string | null, "alternatives": string[]}.`;

const RawSchema = z.object({
  label: z.string().nullable().optional(),
  detail: z.string().nullable().optional(),
  alternatives: z.array(z.string()).optional(),
});

const NON_ANSWERS = /^(null|none|n\/?a|unknown|unclear|unidentifiable|not sure|nothing)$/i;

/** Trims articles/whitespace and maps the model's "I don't know" spellings to null. */
export function cleanLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^(a|an|the)\s+/i, '');
  if (!trimmed || NON_ANSWERS.test(trimmed)) return null;
  return trimmed.slice(0, 80);
}

/** Pure: turn a raw vision-model JSON body into a validated IdentifiedSubject. */
export function normalizeIdentification(raw: unknown): IdentifiedSubject {
  const parsed = RawSchema.safeParse(raw);
  if (!parsed.success) return { label: null, detail: null, alternatives: [] };

  const label = cleanLabel(parsed.data.label);
  const alternatives = (parsed.data.alternatives ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toLowerCase() !== label?.toLowerCase())
    .slice(0, 4);

  return {
    label,
    detail: label ? parsed.data.detail?.trim() || null : null,
    alternatives,
  };
}

/**
 * Sends the captured photo (base64, no data: prefix) to the active vision model and returns
 * what it thinks the subject is. Throws an ApiError on a provider failure (bad key, overload);
 * a successful call with no recognizable subject resolves with `label: null`.
 */
export async function identifyImageSubject(
  base64: string,
  contentType: string
): Promise<IdentifiedSubject> {
  const raw = await askVisionJson('identify', PROMPT, { base64, contentType });
  const result = normalizeIdentification(raw);
  logger.info('identify', 'Vision identification result', {
    label: result.label,
    alternativeCount: result.alternatives.length,
  });
  return result;
}
