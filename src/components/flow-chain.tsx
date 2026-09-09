import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, ThemeColors } from '@/constants/theme';
import { STAGGER } from '@/lib/motion';
import { useTheme } from '@/hooks/use-theme';

export function FlowChain({ steps }: { steps: string[] }) {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);

  return (
    <View>
      {steps.map((step, index) => (
        <Animated.View
          key={`${step}-${index}`}
          entering={FadeInDown.duration(220).delay(index * STAGGER)}>
          <View style={themedStyles.box}>
            <ThemedText type="bodyMedium" style={styles.boxText}>
              {step}
            </ThemedText>
          </View>
          {index < steps.length - 1 && <View style={themedStyles.connector} />}
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  boxText: { textAlign: 'center' },
});

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    box: {
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radii.md,
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.three,
    },
    connector: {
      width: 2,
      height: 22,
      alignSelf: 'center',
      borderLeftWidth: 2,
      borderLeftColor: theme.accentSoft,
      borderStyle: 'dashed',
      marginVertical: 2,
    },
  });
}
