import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Ink, Radii, Spacing } from '@/constants/theme';
import { DUR_TOAST_IN, DUR_TOAST_OUT, EASE_OUT } from '@/lib/motion';
import { useToast } from '@/hooks/use-toast';

export function ToastHost() {
  const { message } = useToast();

  // The container stays mounted so Reanimated can play the exit animation when `message`
  // clears (the exiting view's parent must outlive it).
  return (
    <View style={styles.container} pointerEvents="none">
      <SafeAreaView>
        {message ? (
          // Enters and exits along the same path (down/up); exit runs ~20% faster since the
          // user has finished reading (apple-design §7).
          <Animated.View
            key={message}
            entering={FadeInDown.duration(DUR_TOAST_IN).easing(EASE_OUT)}
            exiting={FadeOutDown.duration(DUR_TOAST_OUT).easing(EASE_OUT)}
            style={styles.pill}>
            <ThemedText themeColor="textInverse" type="small">
              {message}
            </ThemedText>
          </Animated.View>
        ) : null}
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
