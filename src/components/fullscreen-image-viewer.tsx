import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  function reset() {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }

  function handleClose() {
    reset();
    onClose();
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= MIN_SCALE) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Panning is screen-space based, which only lines up correctly when the image isn't
  // rotated -- skip it in landscape mode rather than risk inverted drag directions.
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const maxX = Math.max(((scale.value - 1) * width) / 2, 0);
      const maxY = Math.max(((scale.value - 1) * height) / 2, 0);
      translateX.value = Math.min(Math.max(savedTranslateX.value + e.translationX, -maxX), maxX);
      translateY.value = Math.min(Math.max(savedTranslateY.value + e.translationY, -maxY), maxY);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const tripleTap = Gesture.Tap()
    .numberOfTaps(3)
    .onEnd(() => {
      runOnJS(handleClose)();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .requireExternalGestureToFail(tripleTap)
    .onEnd(() => {
      scale.value = withTiming(MIN_SCALE);
      savedScale.value = MIN_SCALE;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const zoomAndPanGesture = rotated ? pinch : Gesture.Simultaneous(pinch, pan);
  const gesture = Gesture.Race(tripleTap, doubleTap, zoomAndPanGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: rotated ? 0 : translateX.value },
      { translateY: rotated ? 0 : translateY.value },
      { scale: scale.value },
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
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          style={[styles.closeButton, { top: insets.top + 12, right: insets.right + 16 }]}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
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
