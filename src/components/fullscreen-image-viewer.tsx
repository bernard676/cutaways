import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { SPRING_DEFAULT } from '@/lib/motion';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

interface FullscreenImageViewerProps {
  uri: string;
  visible: boolean;
  /** Rotates the image 90° so it fills the screen edge-to-edge once the phone is turned landscape. */
  rotated?: boolean;
  onClose: () => void;
}

export function FullscreenImageViewer({ uri, visible, rotated = false, onClose }: FullscreenImageViewerProps) {
  const { width, height } = useWindowDimensions();
  // The Modal renders its content in a separate native view hierarchy on iOS, so a
  // SafeAreaProvider nested inside it can't be trusted to remeasure insets. Read insets
  // from the already-mounted provider higher up in the app tree instead.
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  function reset() {
    scale.set(1);
    savedScale.set(1);
    translateX.set(0);
    translateY.set(0);
    savedTranslateX.set(0);
    savedTranslateY.set(0);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const gesture = useMemo(() => {
    const settle = (value: number) => (reduced ? value : withSpring(value, SPRING_DEFAULT));

    const pinch = Gesture.Pinch()
      .onUpdate((e) => {
        scale.set(Math.min(Math.max(savedScale.get() * e.scale, MIN_SCALE), MAX_SCALE));
      })
      .onEnd(() => {
        savedScale.set(scale.get());
        if (scale.get() <= MIN_SCALE) {
          translateX.set(withTiming(0));
          translateY.set(withTiming(0));
          savedTranslateX.set(0);
          savedTranslateY.set(0);
        }
      });

    // Panning is screen-space based, which only lines up correctly when the image isn't
    // rotated -- skip it in landscape mode rather than risk inverted drag directions.
    const pan = Gesture.Pan()
      .onUpdate((e) => {
        const maxX = Math.max(((scale.get() - 1) * width) / 2, 0);
        const maxY = Math.max(((scale.get() - 1) * height) / 2, 0);
        translateX.set(Math.min(Math.max(savedTranslateX.get() + e.translationX, -maxX), maxX));
        translateY.set(Math.min(Math.max(savedTranslateY.get() + e.translationY, -maxY), maxY));
      })
      .onEnd(() => {
        savedTranslateX.set(translateX.get());
        savedTranslateY.set(translateY.get());
      });

    const tripleTap = Gesture.Tap()
      .numberOfTaps(3)
      .onEnd(() => {
        scheduleOnRN(handleClose);
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .requireExternalGestureToFail(tripleTap)
      .onEnd(() => {
        scale.set(settle(MIN_SCALE));
        savedScale.set(MIN_SCALE);
        translateX.set(settle(0));
        translateY.set(settle(0));
        savedTranslateX.set(0);
        savedTranslateY.set(0);
      });

    const zoomAndPan = rotated ? pinch : Gesture.Simultaneous(pinch, pan);
    return Gesture.Race(tripleTap, doubleTap, zoomAndPan);
    // handleClose closes over onClose; reset only touches shared values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, rotated, width, height, onClose]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: rotated ? 0 : translateX.get() },
      { translateY: rotated ? 0 : translateY.get() },
      { scale: scale.get() },
    ],
  }));

  // Swap the layout box to the screen's rotated (height x width) footprint, then rotate it
  // 90deg back into the portrait frame -- rotation is a paint-time transform, so it doesn't
  // affect the box's own centering, and the result lines up edge-to-edge once the phone
  // itself is turned to landscape.
  const rotatedWrapStyle = rotated ? { width: height, height: width, transform: [{ rotate: '90deg' as const }] } : null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.container}>
        <PressableScale
          onPress={handleClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close fullscreen image"
          style={[styles.closeButton, { top: insets.top + 12, right: insets.right + 16 }]}>
          <Ionicons name="close" size={26} color="#fff" />
        </PressableScale>
        <View style={rotatedWrapStyle ?? styles.imageWrap}>
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.imageWrap, animatedStyle]}>
              <Image source={{ uri }} style={styles.image} contentFit="contain" />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: { position: 'absolute', zIndex: 10, padding: 8 },
  imageWrap: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
});
