import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Radii, ThemeColors } from '@/constants/theme';
import { DUR_ENTER, EASE_IN_OUT } from '@/lib/motion';
import { useTheme } from '@/hooks/use-theme';

export function ProgressBar({ progress }: { progress: number }) {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(100, progress));

  // The fill is an absolutely-positioned childless element, so animating its `width` is the
  // one sanctioned width animation (animate-expo §4) — nothing else re-lays-out, and the
  // corner radius survives where a `scaleX` would smear it.
  const width = useSharedValue(pct);
  useEffect(() => {
    width.set(reduced ? pct : withTiming(pct, { duration: DUR_ENTER, easing: EASE_IN_OUT }));
  }, [pct, reduced, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.get()}%` }));

  return (
    <Animated.View style={themedStyles.track}>
      <Animated.View style={[themedStyles.fill, fillStyle]} />
    </Animated.View>
  );
}

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    track: {
      height: 6,
      borderRadius: Radii.full,
      backgroundColor: theme.backgroundSunken,
      overflow: 'hidden',
    },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: Radii.full,
      backgroundColor: theme.accent,
    },
  });
}
