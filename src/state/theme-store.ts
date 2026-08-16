import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

import { logger } from '@/lib/logger';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'visualpedia.themePreference';

let themePreference: ThemePreference = 'system';
let systemScheme: ResolvedTheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((listener) => listener());
}

Appearance.addChangeListener(({ colorScheme }) => {
  systemScheme = colorScheme === 'dark' ? 'dark' : 'light';
  if (themePreference === 'system') notify();
});

/** Call once at app startup to restore the user's last-picked theme, if any. */
export async function loadThemePreference(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      themePreference = stored;
      notify();
    }
  } catch (err) {
    logger.error('theme-store', 'Failed to load persisted theme preference', err);
  }
}

export function getThemePreference(): ThemePreference {
  return themePreference;
}

export function getResolvedTheme(): ResolvedTheme {
  return themePreference === 'system' ? systemScheme : themePreference;
}

export async function setThemePreference(next: ThemePreference): Promise<void> {
  themePreference = next;
  notify();
  try {
    await AsyncStorage.setItem(THEME_KEY, next);
  } catch (err) {
    logger.error('theme-store', 'Failed to persist theme preference', err);
  }
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
