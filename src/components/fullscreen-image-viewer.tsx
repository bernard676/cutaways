import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 3;

interface FullscreenImageViewerProps {
  uri: string;
  visible: boolean;
  flipped?: boolean;
  onClose: () => void;
}

export function FullscreenImageViewer({ uri, visible, flipped = false, onClose }: FullscreenImageViewerProps) {
  const { width, height } = useWindowDimensions();

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

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? MIN_SCALE : DOUBLE_TAP_SCALE;
      scale.value = withTiming(next);
      savedScale.value = next;
      if (next === MIN_SCALE) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { scaleX: flipped ? -1 : 1 },
    ],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.closeButton}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.imageWrap, animatedStyle]}>
              <Image source={{ uri }} style={styles.image} contentFit="contain" />
            </Animated.View>
          </GestureDetector>
        </SafeAreaView>
      </SafeAreaProvider>
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
  closeButton: { position: 'absolute', top: 12, right: 16, zIndex: 10, padding: 8 },
  imageWrap: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
});
