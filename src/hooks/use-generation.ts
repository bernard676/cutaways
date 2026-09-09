import { useCallback, useRef, useState } from 'react';

import { ApiError, GENERIC_ERROR_MESSAGE } from '@/lib/ai/errors';
import { logger } from '@/lib/logger';
import { runGeneration } from '@/services/generation';
import { GenerationStatus } from '@/types/knowledge';

export type GenerationPhase = GenerationStatus | 'idle';

interface UseGenerationResult {
  phase: GenerationPhase;
  error: string | null;
  /** True when the failure was a transient overload (429/5xx) worth retrying, not a permanent one (bad key, quota). */
  retryable: boolean;
  topicId: string | null;
  start: (query: string, parentContext?: string) => Promise<void>;
  /** Resubmits the last request unchanged. */
  retry: () => void;
  reset: () => void;
}

export function useGeneration(): UseGenerationResult {
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [topicId, setTopicId] = useState<string | null>(null);
  const lastRequest = useRef<{ query: string; parentContext?: string } | null>(null);

  const run = useCallback(async (query: string, parentContext?: string) => {
    lastRequest.current = { query, parentContext };
    setError(null);
    setRetryable(false);
    setTopicId(null);
    setPhase('pending');
    try {
      const id = await runGeneration(query, setPhase, parentContext);
      setTopicId(id);
    } catch (err) {
      logger.error('useGeneration', 'Generation failed', err);
      setPhase('failed');
      setError(GENERIC_ERROR_MESSAGE);
      if (err instanceof ApiError && err.retryable) {
        setRetryable(true);
      }
    }
  }, []);

  const start = useCallback(
    (query: string, parentContext?: string) => run(query, parentContext),
    [run]
  );

  const retry = useCallback(() => {
    if (!lastRequest.current) return;
    const { query, parentContext } = lastRequest.current;
    run(query, parentContext);
  }, [run]);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setRetryable(false);
    setTopicId(null);
  }, []);

  return { phase, error, retryable, topicId, start, retry, reset };
}
