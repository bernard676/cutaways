import { useCallback, useState } from 'react';

import { logger } from '@/lib/logger';
import { runGeneration } from '@/services/generation';
import { GenerationStatus } from '@/types/knowledge';

export type GenerationPhase = GenerationStatus | 'idle';

interface UseGenerationResult {
  phase: GenerationPhase;
  error: string | null;
  topicId: string | null;
  start: (query: string, parentContext?: string) => Promise<void>;
  reset: () => void;
}

export function useGeneration(): UseGenerationResult {
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);

  const start = useCallback(async (query: string, parentContext?: string) => {
    setError(null);
    setTopicId(null);
    setPhase('pending');
    try {
      const id = await runGeneration(query, setPhase, parentContext);
      setTopicId(id);
    } catch (err) {
      logger.error('useGeneration', 'Generation failed', err);
      setPhase('failed');
      setError(err instanceof Error ? err.message : 'Failed to generate topic');
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setTopicId(null);
  }, []);

  return { phase, error, topicId, start, reset };
}
