import { logger } from '@/lib/logger';

/**
 * Thrown by throwCleanApiError instead of a plain Error so callers (useGeneration, chat) can
 * tell a transient/overload failure (rate-limited or the provider is temporarily down -- worth
 * offering a retry, possibly against a smaller/less-contested fallback model) apart from a
 * permanent one (bad key, quota exhausted -- retrying won't help). `scope` mirrors the first
 * arg passed to throwCleanApiError (e.g. 'llm', 'image') so a retry can target the model that
 * actually failed.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly scope: string,
    public readonly provider: string,
    public readonly status: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Every AI call site should route a non-2xx response through this instead of throwing the raw
 * response body: the full JSON/text detail goes to the logger (for debugging), but the error
 * that actually propagates up to the UI is a short, human-readable message -- customers should
 * never see a raw API error blob.
 */
export async function throwCleanApiError(
  scope: string,
  provider: string,
  response: Response,
  // Callers that already catch this and log their own (quieter) warning on the fallback path
  // -- e.g. embeddings, which both search and generation treat as optional -- pass silent:true
  // so a permanent condition like a billing quota doesn't re-log the full raw error body on
  // every single keystroke/request.
  options?: { silent?: boolean }
): Promise<never> {
  const raw = await response.text();
  const quotaExceeded = /insufficient_quota/.test(raw);
  if (!options?.silent) {
    logger.warn(scope, `${provider} request failed`, { status: response.status, raw });
  }
  const retryable = !quotaExceeded && (response.status === 429 || response.status >= 500);
  throw new ApiError(
    friendlyMessage(provider, response.status, quotaExceeded),
    scope,
    provider,
    response.status,
    retryable
  );
}

function friendlyMessage(provider: string, status: number, quotaExceeded: boolean): string {
  if (status === 401 || status === 403) {
    return `${provider} rejected the request — check the API key in Settings.`;
  }
  if (quotaExceeded) {
    return `${provider} has run out of billing quota — check your plan/billing.`;
  }
  if (status === 429) {
    return `${provider} is rate-limiting requests right now. Try again in a moment.`;
  }
  if (status >= 500) {
    return `${provider} is temporarily unavailable. Try again shortly.`;
  }
  return `Something went wrong talking to ${provider}. Try again.`;
}
