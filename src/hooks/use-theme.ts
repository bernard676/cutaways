import { useSyncExternalStore } from 'react';

import { Colors, ThemeColors } from '@/constants/theme';
import {
  getResolvedTheme,
  getThemePreference,
  ResolvedTheme,
  subscribeTheme,
  ThemePreference,
} from '@/state/theme-store';

/** The resolved ('light' | 'dark') color object for the user's current theme preference. */
export function useTheme(): ThemeColors {
  const resolved = useColorScheme();
  return Colors[resolved];
}

/** 'light' | 'dark' -- 'system' preference is already resolved against the OS scheme. */
export function useColorScheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeTheme, getResolvedTheme);
}

/** The raw stored preference ('light' | 'dark' | 'system'), for the settings screen. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribeTheme, getThemePreference);
}
