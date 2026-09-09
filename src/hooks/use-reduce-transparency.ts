import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the OS "Reduce Transparency" accessibility setting so blur/translucent chrome can
 * fall back to a solid surface (apple-design §14). Module store + `useSyncExternalStore`,
 * same shape as `src/state/theme-store.ts`.
 */
let reduceTransparency = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

AccessibilityInfo.isReduceTransparencyEnabled?.()
  .then((value) => {
    if (value !== reduceTransparency) {
      reduceTransparency = value;
      notify();
    }
  })
  .catch(() => {});

AccessibilityInfo.addEventListener('reduceTransparencyChanged', (value: boolean) => {
  reduceTransparency = value;
  notify();
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return reduceTransparency;
}

export function useReduceTransparency(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
