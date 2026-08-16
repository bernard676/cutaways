import { throwCleanApiError } from '@/lib/ai/errors';

// Embeddings always go through OpenAI regardless of EXPO_PUBLIC_LLM_PROVIDER -- Anthropic has
// no embeddings API, and visualpedia_topics.embedding is fixed at vector(1536) to match
// text-embedding-3-small's output dimension.
const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('An OpenAI API key is required for search, even when Claude is selected.');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!response.ok) {
    // Search/embeddings always use OpenAI even when Claude is selected for the language
    // model (Anthropic has no embeddings API) -- label it so this doesn't look linked to
    // whichever provider is currently selected in Settings.
    await throwCleanApiError('embeddings', 'OpenAI (search)', response);
  }

  const data = await response.json();
  return data.data[0].embedding as number[];
}
