import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/lib/ai/errors';
import { getFallbackImageModel } from '@/lib/ai/image';
import { getFallbackTextModel } from '@/lib/ai/llm';
import { logger } from '@/lib/logger';
import { GenerationModelOverrides, runGeneration } from '@/services/generation';
import { getImageProvider, getLlmProvider } from '@/state/settings-store';
import { GenerationStatus } from '@/types/knowledge';

export type GenerationPhase = GenerationStatus | 'idle';

interface UseGenerationResult {
  phase: GenerationPhase;
  error: string | null;
  /** True when the failure was a transient overload (429/5xx) worth retrying, not a permanent one (bad key, quota). */
  retryable: boolean;
  topicId: string | null;
  start: (query: string, parentContext?: string) => Promise<void>;
  /** Resubmits the last request, using a smaller/less-contested model for whichever step failed, if one exists. */
  retry: () => void;
  reset: () => void;
}

export function useGeneration(): UseGenerationResult {
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [topicId, setTopicId] = useState<string | null>(null);
  const lastRequest = useRef<{ query: string; parentContext?: string } | null>(null);
  const failedScope = useRef<string | null>(null);

  const run = useCallback(
    async (query: string, parentContext?: string, modelOverrides?: GenerationModelOverrides) => {
      lastRequest.current = { query, parentContext };
      setError(null);
      setRetryable(false);
      failedScope.current = null;
      setTopicId(null);
      setPhase('pending');
      try {
        const id = await runGeneration(query, setPhase, parentContext, modelOverrides);
        setTopicId(id);
      } catch (err) {
        logger.error('useGeneration', 'Generation failed', err);
        setPhase('failed');
        setError(err instanceof Error ? err.message : 'Failed to generate topic');
        if (err instanceof ApiError && err.retryable) {
          setRetryable(true);
          failedScope.current = err.scope;
        }
      }
    },
    []
  );

  const start = useCallback((query: string, parentContext?: string) => run(query, parentContext), [run]);

  const retry = useCallback(() => {
    if (!lastRequest.current) return;
    const { query, parentContext } = lastRequest.current;
    let modelOverrides: GenerationModelOverrides | undefined;
    if (failedScope.current === 'llm') {
      const fallback = getFallbackTextModel(getLlmProvider());
      if (fallback) modelOverrides = { llm: fallback };
    } else if (failedScope.current === 'image') {
      const fallback = getFallbackImageModel(getImageProvider());
      if (fallback) modelOverrides = { image: fallback };
    }
    run(query, parentContext, modelOverrides);
  }, [run]);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setRetryable(false);
    setTopicId(null);
  }, []);

  return { phase, error, retryable, topicId, start, retry, reset };
}
