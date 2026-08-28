import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/lib/logger';

export type LlmProvider = 'openai' | 'anthropic' | 'gemini';
export type ImageProvider = 'openai' | 'gemini';

const LLM_KEY = 'sketchStudios.llmProvider';
const IMAGE_KEY = 'sketchStudios.imageProvider';

function resolveLlmProvider(): LlmProvider {
  if (process.env.EXPO_PUBLIC_LLM_PROVIDER === 'anthropic') return 'anthropic';
  if (process.env.EXPO_PUBLIC_LLM_PROVIDER === 'gemini') return 'gemini';
  return 'openai';
}

let llmProvider: LlmProvider = resolveLlmProvider();
let imageProvider: ImageProvider =
  process.env.EXPO_PUBLIC_IMAGE_PROVIDER === 'gemini' ? 'gemini' : 'openai';

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((listener) => listener());
}

/** Call once at app startup to restore the user's last-picked provider, if any. */
export async function loadSettings(): Promise<void> {
  try {
    const [storedLlm, storedImage] = await Promise.all([
      AsyncStorage.getItem(LLM_KEY),
      AsyncStorage.getItem(IMAGE_KEY),
    ]);
    if (storedLlm === 'openai' || storedLlm === 'anthropic' || storedLlm === 'gemini') {
      llmProvider = storedLlm;
    }
    if (storedImage === 'openai' || storedImage === 'gemini') imageProvider = storedImage;
    notify();
  } catch (err) {
    logger.error('settings-store', 'Failed to load persisted settings', err);
  }
}

export function getLlmProvider(): LlmProvider {
  return llmProvider;
}

export function getImageProvider(): ImageProvider {
  return imageProvider;
}

/**
 * Overrides the env-derived LLM provider for this install and persists the choice. Chat and
 * embeddings follow this too (embeddings via resolveEmbeddingProvider). Existing topics keep
 * whatever embedding they were created with -- see scripts/backfill-embeddings.js to re-embed.
 */
export async function setLlmProvider(next: LlmProvider): Promise<void> {
  llmProvider = next;
  notify();
  try {
    await AsyncStorage.setItem(LLM_KEY, next);
  } catch (err) {
    logger.error('settings-store', 'Failed to persist LLM provider', err);
  }
}

export async function setImageProvider(next: ImageProvider): Promise<void> {
  imageProvider = next;
  notify();
  try {
    await AsyncStorage.setItem(IMAGE_KEY, next);
  } catch (err) {
    logger.error('settings-store', 'Failed to persist image provider', err);
  }
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
