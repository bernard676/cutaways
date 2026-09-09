import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Spacing, ThemeColors } from '@/constants/theme';
import { DUR_TOGGLE, EASE_IN_OUT } from '@/lib/motion';
import { haptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
}

type Layout = { x: number; width: number };

export function Tabs({ tabs, value, onChange }: TabsProps) {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, Layout>>({});

  // The pill is absolutely positioned with no children, so animating its `width` is
  // sanctioned (animate-expo, "Tab / segmented indicator") — its corner radius survives
  // where a `scaleX` would smear it. `ease-in-out` because it moves across the screen.
  const x = useSharedValue(0);
  const w = useSharedValue(0);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    if (reduced || w.get() === 0) {
      x.set(l.x);
      w.set(l.width);
    } else {
      x.set(withTiming(l.x, { duration: DUR_TOGGLE, easing: EASE_IN_OUT }));
      w.set(withTiming(l.width, { duration: DUR_TOGGLE, easing: EASE_IN_OUT }));
    }
  }, [value, layouts, reduced, x, w]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    width: w.get(),
  }));

  const onTabLayout = (id: string) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[id];
      if (cur && Math.abs(cur.x - lx) < 1 && Math.abs(cur.width - width) < 1) return prev;
      return { ...prev, [id]: { x: lx, width } };
    });
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      <Animated.View style={[themedStyles.pill, pillStyle]} pointerEvents="none" />
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <PressableScale
            key={tab.id}
            onLayout={onTabLayout(tab.id)}
            onPress={() => {
              haptics.selection();
              onChange(tab.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={styles.tab}>
            <ThemedText
              type={active ? 'bodySemiBold' : 'small'}
              themeColor={active ? 'accent' : 'textMuted'}>
              {tab.label}
            </ThemedText>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two, position: 'relative' },
  tab: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
});

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    pill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent,
    },
  });
}
