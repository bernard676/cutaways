import { logger } from '@/lib/logger';

/**
 * Every AI call site should route a non-2xx response through this instead of throwing the raw
 * response body: the full JSON/text detail goes to the logger (for debugging), but the error
 * that actually propagates up to the UI is a short, human-readable message -- customers should
 * never see a raw API error blob.
 */
export async function throwCleanApiError(
  scope: string,
  provider: string,
  response: Response
): Promise<never> {
  const raw = await response.text();
  logger.error(scope, `${provider} request failed`, undefined, { status: response.status, raw });
  throw new Error(friendlyMessage(provider, response.status));
}

function friendlyMessage(provider: string, status: number): string {
  if (status === 401 || status === 403) {
    return `${provider} rejected the request — check the API key in Settings.`;
  }
  if (status === 429) {
    return `${provider} is rate-limiting requests right now. Try again in a moment.`;
  }
  if (status >= 500) {
    return `${provider} is temporarily unavailable. Try again shortly.`;
  }
  return `Something went wrong talking to ${provider}. Try again.`;
}
