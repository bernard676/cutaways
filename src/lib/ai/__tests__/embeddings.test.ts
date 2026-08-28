import { EMBEDDING_PROVIDER_LABEL, resolveEmbeddingProvider } from '@/lib/ai/embeddings';

describe('resolveEmbeddingProvider', () => {
  it('uses Gemini natively when the LLM provider is Gemini', () => {
    expect(resolveEmbeddingProvider('gemini')).toBe('gemini');
  });

  it('falls back to OpenAI for Anthropic (no embeddings API) and for OpenAI itself', () => {
    expect(resolveEmbeddingProvider('anthropic')).toBe('openai');
    expect(resolveEmbeddingProvider('openai')).toBe('openai');
  });

  it('has a display label for every embedding provider it can return', () => {
    expect(EMBEDDING_PROVIDER_LABEL.openai).toBeTruthy();
    expect(EMBEDDING_PROVIDER_LABEL.gemini).toBeTruthy();
  });
});
