import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/lib/logger';

export type LlmProvider = 'openai' | 'anthropic' | 'gemini';
export type ImageProvider = 'openai' | 'gemini';

const LLM_KEY = 'visualpedia.llmProvider';
const IMAGE_KEY = 'visualpedia.imageProvider';

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

export async function setLlmProvider(next: LlmProvider): Promise<void> {
  llmProvider = next;
  notify();
  try {
    await AsyncStorage.setItem(LLM_KEY, next);
  } catch (err) {
    logger.error('settings-store', 'Failed to persist llmProvider', err);
  }
}

export async function setImageProvider(next: ImageProvider): Promise<void> {
  imageProvider = next;
  notify();
  try {
    await AsyncStorage.setItem(IMAGE_KEY, next);
  } catch (err) {
    logger.error('settings-store', 'Failed to persist imageProvider', err);
  }
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
