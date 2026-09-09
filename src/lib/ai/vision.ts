// Shared "send an image + a prompt, get JSON back" helper for the vision calls the app makes
// client-side (no backend -- see AGENTS.md). Uses Claude, which accepts an inline base64 image.
// Callers own error handling: this throws an ApiError (via throwCleanApiError) on a non-2xx
// response and returns `null` when the model produced no parseable content.

import { throwCleanApiError } from '@/lib/ai/errors';
import { TEXT_MODEL } from '@/lib/ai/llm';

export interface VisionImage {
  /** Base64-encoded image bytes, no data: prefix. */
  base64: string;
  /** e.g. "image/jpeg", "image/png". */
  contentType: string;
}

export interface AskVisionOptions {
  /**
   * Suppress the raw-provider-body warn log on a non-2xx response (the ApiError is still
   * thrown). Set by best-effort callers that will log their own "continuing without X" line.
   */
  silent?: boolean;
}

/**
 * Sends `prompt` plus `image` to Claude and returns the parsed JSON body (typed `unknown` --
 * the caller validates the shape, usually with zod). `scope` is only used to tag error logs.
 * Returns `null` if the model replied with nothing usable.
 */
export async function askVisionJson(
  scope: string,
  prompt: string,
  image: VisionImage,
  options?: AskVisionOptions
): Promise<unknown> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY is required for vision requests');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${prompt}\n\nReturn only the raw JSON object.` },
            {
              type: 'image',
              source: { type: 'base64', media_type: image.contentType, data: image.base64 },
            },
          ],
        },
      ],
    }),
  });
  if (!response.ok) await throwCleanApiError(scope, 'Anthropic', response, { silent: options?.silent });

  const data = await response.json();
  const text = (data.content as { type: string; text?: string }[])?.find(
    (b) => b.type === 'text'
  )?.text;
  return text ? JSON.parse(extractJson(text)) : null;
}

/** Claude sometimes wraps JSON in prose or a ```json fence despite the instruction. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}
