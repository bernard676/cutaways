import { PropsWithChildren, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DUR_TOAST_OUT, EASE_OUT, project, SPRING_MOMENTUM } from '@/lib/motion';

interface SwipeToDismissProps extends PropsWithChildren {
  onDismiss: () => void;
}

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 500; // px/s — a flick past this commits even without the distance

/**
 * Horizontal swipe-to-dismiss for local, non-navigational UI (like an inline error banner on
 * a root screen) -- NOT a substitute for the native stack's edge-swipe-back gesture, which
 * only applies to pushed screens and works on its own via Expo Router's default Stack.
 *
 * The dismiss decision uses momentum projection (velocity OR distance), and the release
 * velocity is handed to the fly-out spring so there's no seam between finger and animation.
 */
export function SwipeToDismiss({ onDismiss, children }: SwipeToDismissProps) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .onUpdate((e) => {
          translateX.set(e.translationX);
          opacity.set(1 - Math.min(Math.abs(e.translationX) / 200, 0.6));
        })
        .onEnd((e) => {
          const projected = e.translationX + project(e.velocityX);
          const commit =
            Math.abs(projected) > DISMISS_DISTANCE || Math.abs(e.velocityX) > DISMISS_VELOCITY;
          if (commit) {
            const direction = (e.velocityX || e.translationX) > 0 ? 1 : -1;
            if (reduced) {
              opacity.set(withTiming(0, { duration: DUR_TOAST_OUT }, (f) => f && scheduleOnRN(onDismiss)));
            } else {
              translateX.set(
                withSpring(direction * width, { ...SPRING_MOMENTUM, velocity: e.velocityX })
              );
              opacity.set(withTiming(0, { duration: 180, easing: EASE_OUT }, (f) => f && scheduleOnRN(onDismiss)));
            }
          } else {
            translateX.set(withSpring(0, { ...SPRING_MOMENTUM, velocity: e.velocityX }));
            opacity.set(withTiming(1, { duration: 180 }));
          }
        }),
    [onDismiss, reduced, width, translateX, opacity]
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: reduced ? 0 : translateX.get() }],
    opacity: opacity.get(),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
