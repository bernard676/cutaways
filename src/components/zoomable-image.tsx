import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
import { SPRING_MOMENTUM, STAGGER } from '@/lib/motion';
import { useTheme } from '@/hooks/use-theme';
import { ComponentBoundingBox } from '@/types/knowledge';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export interface ImageHotspot {
  bbox: ComponentBoundingBox;
  label: string;
  onPress: () => void;
}

interface ZoomableImageProps {
  uri: string;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
  hotspots?: ImageHotspot[];
}

export function ZoomableImage({ uri, aspectRatio = 1, style, hotspots = [] }: ZoomableImageProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const gesture = useMemo(() => {
    // Pinch zooms the image in place -- no panning, so the image never drifts out from under
    // the surrounding page.
    const pinch = Gesture.Pinch()
      .onUpdate((e) => {
        const next = savedScale.get() * e.scale;
        scale.set(Math.min(Math.max(next, MIN_SCALE), MAX_SCALE));
      })
      .onEnd(() => {
        savedScale.set(scale.get());
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        const next = scale.get() > 1 ? 1 : 2;
        // A double-tap zoom is a deliberate flick-like gesture — a little momentum reads right.
        scale.set(reduced ? next : withSpring(next, SPRING_MOMENTUM));
        savedScale.set(next);
      });

    return Gesture.Race(doubleTap, pinch);
  }, [reduced, scale, savedScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ aspectRatio, overflow: 'hidden' }, style, animatedStyle]}>
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        {hotspots.map((hotspot, index) => (
          <Animated.View
            key={`${hotspot.label}-${index}`}
            entering={FadeIn.duration(220).delay(200 + index * STAGGER)}
            style={{
              position: 'absolute',
              left: `${hotspot.bbox.x * 100}%`,
              top: `${hotspot.bbox.y * 100}%`,
              width: `${hotspot.bbox.width * 100}%`,
              height: `${hotspot.bbox.height * 100}%`,
            }}>
            <PressableScale
              onPress={hotspot.onPress}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={`Component: ${hotspot.label}`}
              style={{
                width: '100%',
                height: '100%',
                borderWidth: 1.5,
                borderColor: theme.accent,
                borderStyle: 'dashed',
                borderRadius: 4,
              }}>
              <ThemedText
                type="mono"
                themeColor="accent"
                numberOfLines={1}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: -19,
                  backgroundColor: theme.backgroundElement,
                  borderWidth: 1,
                  borderColor: theme.accentSoft,
                  borderRadius: Radii.sm,
                  paddingHorizontal: 5,
                  paddingVertical: 1.5,
                }}>
                {hotspot.label}
              </ThemedText>
            </PressableScale>
          </Animated.View>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}
