// Shared "send an image + a prompt, get JSON back" helper for the vision calls the app makes
// client-side (no backend -- see AGENTS.md). Follows the selected LLM provider; all three
// (OpenAI, Anthropic, Gemini) accept an inline base64 image and can be asked for JSON.
// Callers own error handling: this throws an ApiError (via throwCleanApiError) on a non-2xx
// response and returns `null` when the model produced no parseable content.

import { throwCleanApiError } from '@/lib/ai/errors';
import { getLlmProvider } from '@/state/settings-store';

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
 * Sends `prompt` plus `image` to the active provider's vision model and returns the parsed
 * JSON body (typed `unknown` -- the caller validates the shape, usually with zod). `scope` is
 * only used to tag error logs. Returns `null` if the model replied with nothing usable.
 */
export async function askVisionJson(
  scope: string,
  prompt: string,
  image: VisionImage,
  options?: AskVisionOptions
): Promise<unknown> {
  const provider = getLlmProvider();
  if (provider === 'anthropic') return askAnthropic(scope, prompt, image, options);
  if (provider === 'gemini') return askGemini(scope, prompt, image, options);
  return askOpenAI(scope, prompt, image, options);
}

async function askOpenAI(
  scope: string,
  prompt: string,
  image: VisionImage,
  options?: AskVisionOptions
): Promise<unknown> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY is required for vision requests');

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
            {
              type: 'image_url',
              image_url: { url: `data:${image.contentType};base64,${image.base64}` },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) await throwCleanApiError(scope, 'OpenAI', response, { silent: options?.silent });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return content ? JSON.parse(content) : null;
}

async function askAnthropic(
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
      model: process.env.EXPO_PUBLIC_ANTHROPIC_TEXT_MODEL ?? 'claude-sonnet-5',
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

async function askGemini(
  scope: string,
  prompt: string,
  image: VisionImage,
  options?: AskVisionOptions
): Promise<unknown> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is required for vision requests');

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
              { inlineData: { mimeType: image.contentType, data: image.base64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!response.ok) await throwCleanApiError(scope, 'Gemini', response, { silent: options?.silent });

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
