import { ApiError, GENERIC_ERROR_MESSAGE, throwCleanApiError } from '@/lib/ai/errors';

// throwCleanApiError logs the raw provider body via logger.warn -- expected here, silence it.
beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterAll(() => (console.warn as jest.Mock).mockRestore());

function fakeResponse(status: number, body: string): Response {
  return { status, text: async () => body } as unknown as Response;
}

async function classify(status: number, body = '{}') {
  try {
    await throwCleanApiError('llm', 'OpenAI', fakeResponse(status, body));
  } catch (err) {
    return err as ApiError;
  }
  throw new Error('throwCleanApiError did not throw');
}

describe('throwCleanApiError', () => {
  it('marks 429 and 5xx as retryable', async () => {
    expect((await classify(429)).retryable).toBe(true);
    expect((await classify(503)).retryable).toBe(true);
  });

  it('marks 4xx auth errors as non-retryable with a key hint', async () => {
    const err = await classify(401);
    expect(err.retryable).toBe(false);
    expect(err.message).toMatch(/API key/i);
  });

  it('treats an exhausted quota as non-retryable even on a 429', async () => {
    const err = await classify(429, '{"error":{"code":"insufficient_quota"}}');
    expect(err.retryable).toBe(false);
    expect(err.message).toMatch(/quota/i);
  });

  it('carries scope and provider for targeted retry', async () => {
    const err = await classify(500);
    expect(err.scope).toBe('llm');
    expect(err.provider).toBe('OpenAI');
    expect(err).toBeInstanceOf(ApiError);
  });

  it('never leaks the raw provider body into the user-facing message', async () => {
    const err = await classify(500, 'stack trace with secret-ish text');
    expect(err.message).not.toContain('secret-ish');
  });
});

describe('GENERIC_ERROR_MESSAGE', () => {
  it('is a friendly, provider-agnostic string', () => {
    expect(GENERIC_ERROR_MESSAGE).not.toMatch(/openai|anthropic|gemini/i);
  });
});
