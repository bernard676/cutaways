import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radii, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ProgressBar({ progress }: { progress: number }) {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const pct = Math.max(0, Math.min(100, progress));

  return (
    <View style={themedStyles.track}>
      <View style={[themedStyles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    track: {
      height: 6,
      borderRadius: Radii.full,
      backgroundColor: theme.backgroundSunken,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: Radii.full,
      backgroundColor: theme.accent,
    },
  });
}
