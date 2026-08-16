import { useSyncExternalStore } from 'react';

import { getImageProvider, getLlmProvider, subscribeSettings } from '@/state/settings-store';

export function useSettings() {
  const llmProvider = useSyncExternalStore(subscribeSettings, getLlmProvider);
  const imageProvider = useSyncExternalStore(subscribeSettings, getImageProvider);
  return { llmProvider, imageProvider };
}
