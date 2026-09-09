import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
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
  const reduced = useReducedMotion();

  // Two identical copies sit side by side. Sliding the track by exactly one copy width lands
  // on a visually identical frame, so the loop seam is invisible. A Reanimated CSS animation
  // runs the loop entirely on the UI thread; reduced motion freezes it in place.
  const animate = copyWidth > 0 && !reduced;
  const trackStyle = animate
    ? {
        animationName: {
          from: { transform: [{ translateX: direction === 1 ? -copyWidth : 0 }] },
          to: { transform: [{ translateX: direction === 1 ? 0 : -copyWidth }] },
        },
        animationDuration: `${(copyWidth / pixelsPerSecond) * 1000}ms`,
        animationTimingFunction: 'linear' as const,
        animationIterationCount: 'infinite' as const,
      }
    : null;

  const onCopyLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - copyWidth) > 1) setCopyWidth(w);
  };

  return (
    <View style={styles.rowClip}>
      <Animated.View style={[styles.rowTrack, trackStyle]}>
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
    <PressableScale
      onPress={item.onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={item.label}
      style={styles.chip}>
      <ThemedText type="small" numberOfLines={1}>
        {item.label}
      </ThemedText>
    </PressableScale>
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
  });
}
