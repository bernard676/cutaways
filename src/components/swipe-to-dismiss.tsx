import { PropsWithChildren } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface SwipeToDismissProps extends PropsWithChildren {
  onDismiss: () => void;
}

const DISMISS_THRESHOLD = 80;
const FLY_OUT_DISTANCE = 400;

/**
 * Horizontal swipe-to-dismiss for local, non-navigational UI (like an inline error banner on
 * a root screen) -- NOT a substitute for the native stack's edge-swipe-back gesture, which
 * only applies to pushed screens and works on its own via Expo Router's default Stack.
 */
export function SwipeToDismiss({ onDismiss, children }: SwipeToDismissProps) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      opacity.value = 1 - Math.min(Math.abs(e.translationX) / 200, 0.6);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > DISMISS_THRESHOLD) {
        const direction = e.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(direction * FLY_OUT_DISTANCE, { duration: 180 });
        opacity.value = withTiming(0, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        });
      } else {
        translateX.value = withTiming(0);
        opacity.value = withTiming(1);
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
