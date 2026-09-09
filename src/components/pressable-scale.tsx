import { forwardRef, useState } from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { DUR_PRESS, EASE_OUT_CSS } from '@/lib/motion';
import { haptics, HapticKind, ImpactFeedbackStyle } from '@/hooks/use-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Default 0.97 — the ceiling for something touched constantly. Use ~0.92 for large targets (a shutter, a FAB). */
  scaleTo?: number;
  /** Fire a haptic on press-in. Paired with the visible scale, per the skill rules. */
  haptic?: HapticKind;
};

/**
 * The single pressable primitive for the app. Feedback lands on press-*in* (never waits for
 * the tap to complete), it's a physical `scale` that carries the label and icons with it
 * (never a flat `opacity` dip), and it's a Reanimated CSS transition — no gesture, no shared
 * value needed for a two-state toggle. Under Reduce Motion it degrades to a small opacity dip.
 *
 * Drop-in replacement for `Pressable` with a plain (non-function) `style`. Replaces the old
 * `style={({ pressed }) => [..., pressed && styles.pressed]}` opacity pattern everywhere.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { scaleTo = 0.97, haptic, onPressIn, onPressOut, style, hitSlop, ...rest },
  ref
) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();

  const feedbackStyle = reduced
    ? {
        opacity: pressed ? 0.85 : 1,
        transitionProperty: 'opacity' as const,
        transitionDuration: `${DUR_PRESS}ms`,
      }
    : {
        transform: [{ scale: pressed ? scaleTo : 1 }],
        transitionProperty: 'transform' as const,
        transitionDuration: `${DUR_PRESS}ms`,
        transitionTimingFunction: EASE_OUT_CSS,
      };

  return (
    <AnimatedPressable
      ref={ref}
      hitSlop={hitSlop ?? 8}
      pressRetentionOffset={16}
      onPressIn={(e) => {
        setPressed(true);
        if (haptic === 'impact') haptics.impact(ImpactFeedbackStyle.Light);
        else if (haptic) haptics[haptic]();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[style, feedbackStyle]}
      {...rest}
    />
  );
});
