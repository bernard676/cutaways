import { Image } from 'expo-image';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
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
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // Pinch zooms the image in place -- no panning, so the image never drifts
  // out from under the surrounding page.
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : 2;
      scale.value = withTiming(next);
      savedScale.value = next;
    });

  const gesture = Gesture.Race(doubleTap, pinch);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ aspectRatio, overflow: 'hidden' }, style, animatedStyle]}>
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        {hotspots.map((hotspot, index) => (
          <Pressable
            key={`${hotspot.label}-${index}`}
            onPress={hotspot.onPress}
            accessibilityRole="button"
            accessibilityLabel={`Component: ${hotspot.label}`}
            style={{
              position: 'absolute',
              left: `${hotspot.bbox.x * 100}%`,
              top: `${hotspot.bbox.y * 100}%`,
              width: `${hotspot.bbox.width * 100}%`,
              height: `${hotspot.bbox.height * 100}%`,
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
          </Pressable>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}
