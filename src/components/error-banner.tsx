import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SwipeToDismiss } from '@/components/swipe-to-dismiss';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ErrorBannerProps {
  message: string;
  retryable: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Animated inline alert for a failed generation/search. Pairs with SwipeToDismiss (which
 * animates the *exit*) to also animate the *entrance* -- a spring pop-in plus a single icon
 * shake -- so a failure reads as a distinct, noticeable event rather than text just appearing.
 */
export function ErrorBanner({ message, retryable, onRetry, onDismiss }: ErrorBannerProps) {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);

  const entrance = useSharedValue(0);
  const shake = useSharedValue(0);

  useEffect(() => {
    entrance.value = withSpring(1, { damping: 14, stiffness: 160 });
    shake.value = withDelay(
      120,
      withSequence(
        withTiming(1, { duration: 60 }),
        withTiming(-1, { duration: 90 }),
        withTiming(0.5, { duration: 90 }),
        withTiming(0, { duration: 90 })
      )
    );
  }, [entrance, shake]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * -14 }, { scale: 0.96 + entrance.value * 0.04 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shake.value * 10}deg` }],
  }));

  return (
    <SwipeToDismiss onDismiss={onDismiss}>
      <Animated.View style={[themedStyles.card, cardStyle]}>
        <Animated.View style={iconStyle}>
          <Ionicons name="alert-circle" size={20} color={theme.statusFailFg} />
        </Animated.View>
        <View style={styles.body}>
          <ThemedText type="bodyMedium" style={styles.message}>
            {message}
          </ThemedText>
          {retryable ? (
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [themedStyles.retryButton, pressed && styles.pressed]}>
              <ThemedText type="bodySemiBold" themeColor="textInverse">
                Retry
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="small" themeColor="textFaint">
              Swipe to dismiss
            </ThemedText>
          )}
        </View>
      </Animated.View>
    </SwipeToDismiss>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: Spacing.two },
  message: { marginTop: 1 },
  pressed: { opacity: 0.7 },
});

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.three,
      backgroundColor: theme.statusFailBg,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.danger,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      marginBottom: Spacing.three,
    },
    retryButton: {
      backgroundColor: theme.accent,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two,
      alignSelf: 'flex-start',
    },
  });
}
