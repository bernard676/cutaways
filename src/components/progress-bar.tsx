import { StyleSheet, View } from 'react-native';

import { Colors, Radii } from '@/constants/theme';

export function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, progress));

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.light.backgroundSunken,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radii.full,
    backgroundColor: Colors.light.accent,
  },
});
