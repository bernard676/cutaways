import { Colors } from '@/constants/theme';

/**
 * The design is light-mode only (see theme.ts) -- this intentionally ignores the device's
 * OS color scheme. Every screen also references `Colors.light.*` directly in its
 * StyleSheet, so if this followed the system scheme instead, ThemedText/ThemedView would
 * flip to dark colors on a dark-mode device while everything else stayed light-styled,
 * producing broken contrast throughout the app.
 */
export function useTheme() {
  return Colors.light;
}
