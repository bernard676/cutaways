import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radii, Spacing } from '@/constants/theme';

export function FlowChain({ steps }: { steps: string[] }) {
  return (
    <View>
      {steps.map((step, index) => (
        <View key={`${step}-${index}`}>
          <View style={styles.box}>
            <ThemedText type="bodyMedium" style={styles.boxText}>
              {step}
            </ThemedText>
          </View>
          {index < steps.length - 1 && <View style={styles.connector} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.md,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  boxText: { textAlign: 'center' },
  connector: {
    width: 2,
    height: 22,
    alignSelf: 'center',
    borderLeftWidth: 2,
    borderLeftColor: Colors.light.accentSoft,
    borderStyle: 'dashed',
    marginVertical: 2,
  },
});
