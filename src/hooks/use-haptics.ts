import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback, guarded so it's a safe no-op on web and never throws on hardware that
 * lacks a taptic engine (most Android). Rules from the `animate-expo` skill:
 *   - one per user action, never on scroll or per frame
 *   - fire on the *causal* moment (the toggle flipping, the detent catching), same frame as
 *     the visual — not when an animation finishes
 *   - never the only feedback; the visible change must stand on its own
 *
 * From a worklet, schedule these on the RN runtime: `scheduleOnRN(haptics.selection)`.
 */
const enabled = Platform.OS !== 'web';

function safe(fn: () => Promise<unknown>) {
  if (!enabled) return;
  try {
    void fn();
  } catch {
    // taptic engine unavailable — the visual feedback carries it
  }
}

export const haptics = {
  /** A value ticked past a step — tab switch, segmented control, theme pick, list selection. */
  selection: () => safe(() => Haptics.selectionAsync()),
  /** Something snapped home / a sheet detent caught / a drag committed. */
  impact: (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) =>
    safe(() => Haptics.impactAsync(style)),
  /** An operation succeeded (bookmark added, photo saved). */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** An operation failed. */
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export type HapticKind = 'selection' | 'impact' | 'success' | 'error';

export function useHaptics() {
  return haptics;
}

/** Re-export so callers can pass a concrete style to `haptics.impact`. */
export { ImpactFeedbackStyle } from 'expo-haptics';
