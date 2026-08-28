import { throwCleanApiError } from '@/lib/ai/errors';
import { getLlmProvider, LlmProvider } from '@/state/settings-store';

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const GEMINI_EMBEDDING_MODEL = process.env.EXPO_PUBLIC_GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001';

// visualpedia_topics.embedding is a fixed vector(1536) column. text-embedding-3-small is
// natively 1536-dim; gemini-embedding-001 defaults to 3072 but supports Matryoshka
// truncation via outputDimensionality, so ask it for 1536 too -- both providers then write
// into the same column. Note this doesn't make the two providers' vectors truly comparable
// (different models' embedding spaces aren't aligned), it just keeps the column usable
// whichever provider produced a given row.
const EMBEDDING_DIMENSIONS = 1536;

export type EmbeddingProvider = 'openai' | 'gemini';

export const EMBEDDING_PROVIDER_LABEL: Record<EmbeddingProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
};

/** Anthropic has no embeddings API, so it rides on OpenAI same as before; every other
 * provider now uses its own embeddings instead of always going through OpenAI. */
export function resolveEmbeddingProvider(llmProvider: LlmProvider): EmbeddingProvider {
  return llmProvider === 'gemini' ? 'gemini' : 'openai';
}

export async function embedText(text: string): Promise<number[]> {
  return resolveEmbeddingProvider(getLlmProvider()) === 'gemini' ? embedWithGemini(text) : embedWithOpenAI(text);
}

async function embedWithOpenAI(text: string): Promise<number[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'An OpenAI API key is required for search when Claude is selected (Anthropic has no embeddings API).'
    );
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: text }),
  });

  if (!response.ok) {
    // Both call sites (search.ts, generation.ts) already catch this and log their own warn on
    // the fallback path, so silence the duplicate raw-body error log here -- otherwise a
    // persistent condition like an exhausted billing quota re-logs the full error body on
    // every single search keystroke.
    await throwCleanApiError('embeddings', 'OpenAI (search)', response, { silent: true });
  }

  const data = await response.json();
  return data.data[0].embedding as number[];
}

async function embedWithGemini(text: string): Promise<number[]> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is required when LLM_PROVIDER=gemini');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        // Top-level fields, not nested under `embedContentConfig` -- the API silently ignores
        // that wrapper (returns the untruncated 3072-dim embedding with no error) and only
        // honors these when they're siblings of `content`.
        // SEMANTIC_SIMILARITY (rather than a directional RETRIEVAL_QUERY/RETRIEVAL_DOCUMENT
        // pair) since, like the OpenAI path, the same call embeds both stored topics and
        // incoming search queries -- one symmetric task type keeps both comparable.
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: 'SEMANTIC_SIMILARITY',
      }),
    }
  );

  if (!response.ok) {
    await throwCleanApiError('embeddings', 'Gemini (search)', response, { silent: true });
  }

  const data = await response.json();
  const values = data.embedding?.values as number[] | undefined;
  if (!values) throw new Error('Gemini returned no embedding');
  return values;
}
