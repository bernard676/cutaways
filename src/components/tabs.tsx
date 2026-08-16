import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, ThemeColors } from '@/constants/theme';
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

export function Tabs({ tabs, value, onChange }: TabsProps) {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, active && themedStyles.tabActive]}>
            <ThemedText type={active ? 'bodySemiBold' : 'small'} themeColor={active ? 'accent' : 'textMuted'}>
              {tab.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  tab: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    tabActive: {
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent,
    },
  });
}
