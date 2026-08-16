import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Ink, Radii, Spacing } from '@/constants/theme';
import { useToast } from '@/hooks/use-toast';

export function ToastHost() {
  const { message } = useToast();
  if (!message) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <SafeAreaView>
        <View style={styles.pill}>
          <ThemedText themeColor="textInverse" type="small">
            {message}
          </ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    marginTop: Spacing.three,
    backgroundColor: Ink[900],
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
});
