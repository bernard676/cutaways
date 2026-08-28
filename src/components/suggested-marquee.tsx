import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MarqueeItem = { key: string; label: string; onPress: () => void };

const ROW_COUNT = 3;
// px/sec each row travels; different speeds keep the three rows from marching in lockstep.
const ROW_PIXELS_PER_SECOND = [30, 20, 46];
// -1 scrolls left, 1 scrolls right. Alternating directions reads as motion, not a conveyor belt.
const ROW_DIRECTION = [-1, 1, -1];
// How many times a row's items repeat inside one copy, so a short list still fills the width
// before the loop seam.
const REPEAT = 4;

function splitIntoRows(items: MarqueeItem[]): MarqueeItem[][] {
  const rows: MarqueeItem[][] = Array.from({ length: ROW_COUNT }, () => []);
  items.forEach((item, i) => rows[i % ROW_COUNT].push(item));
  return rows;
}

export function SuggestedMarquee({ items }: { items: MarqueeItem[] }) {
  const theme = useTheme();
  const styles = themedStyles(theme);

  if (items.length === 0) return null;
  const rows = splitIntoRows(items);

  return (
    <View style={styles.wrap}>
      {rows.map((rowItems, i) =>
        rowItems.length === 0 ? null : (
          <MarqueeRow
            key={i}
            items={rowItems}
            direction={ROW_DIRECTION[i]}
            pixelsPerSecond={ROW_PIXELS_PER_SECOND[i]}
            styles={styles}
          />
        )
      )}
    </View>
  );
}

function MarqueeRow({
  items,
  direction,
  pixelsPerSecond,
  styles,
}: {
  items: MarqueeItem[];
  direction: number;
  pixelsPerSecond: number;
  styles: ReturnType<typeof themedStyles>;
}) {
  const [copyWidth, setCopyWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (copyWidth <= 0) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: (copyWidth / pixelsPerSecond) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [copyWidth, pixelsPerSecond, progress]);

  // Two identical copies sit side by side (total width 2 * copyWidth). Sliding the track by
  // exactly one copy width lands on a frame visually identical to the start, so the reset is
  // invisible. Left-scroll runs 0 -> -w; right-scroll runs -w -> 0.
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 1 ? [-copyWidth, 0] : [0, -copyWidth],
  });

  const onCopyLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - copyWidth) > 1) setCopyWidth(w);
  };

  return (
    <View style={styles.rowClip}>
      <Animated.View style={[styles.rowTrack, { transform: [{ translateX }] }]}>
        {[0, 1].map((copy) => (
          <View
            key={copy}
            style={styles.rowCopy}
            onLayout={copy === 0 ? onCopyLayout : undefined}>
            {Array.from({ length: REPEAT }).flatMap((_, r) =>
              items.map((item) => (
                <Chip key={`${copy}-${r}-${item.key}`} item={item} styles={styles} />
              ))
            )}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function Chip({
  item,
  styles,
}: {
  item: MarqueeItem;
  styles: ReturnType<typeof themedStyles>;
}) {
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
      <ThemedText type="small" numberOfLines={1}>
        {item.label}
      </ThemedText>
    </Pressable>
  );
}

function themedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: Spacing.two, marginBottom: Spacing.five, overflow: 'hidden' },
    rowClip: { overflow: 'hidden' },
    rowTrack: { flexDirection: 'row' },
    // paddingRight spaces the last chip of one copy from the first of the next.
    rowCopy: { flexDirection: 'row', gap: Spacing.two, paddingRight: Spacing.two },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.backgroundElement,
      borderRadius: Radii.full,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one + 2,
    },
    chipPressed: { opacity: 0.6 },
  });
}
