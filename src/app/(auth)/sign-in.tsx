import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logomark } from '@/components/logomark';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing, ThemeColors } from '@/constants/theme';
import { EASE_OUT } from '@/lib/motion';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';

export default function SignInScreen() {
  const { signInWithPassword } = useAuth();
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await signInWithPassword(email.trim(), password);
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError);
    }
    // On success, the (auth) layout redirects to (app) once the session updates.
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.form}>
          <Animated.View entering={FadeInDown.duration(320).easing(EASE_OUT)}>
            <ThemedView style={styles.header}>
              <Logomark size={32} />
              <ThemedText type="display" style={styles.title}>
                Loupe
              </ThemedText>
              <ThemedText themeColor="textMuted" type="body">
                Search anything. See how it works.
              </ThemedText>
            </ThemedView>
          </Animated.View>

          <ThemedView style={styles.fields}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={theme.textFaint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={themedStyles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              style={themedStyles.input}
            />
          </ThemedView>

          {error && (
            <Animated.View entering={FadeInDown.duration(220).easing(EASE_OUT)}>
              <ThemedText themeColor="danger" type="small">
                {error}
              </ThemedText>
            </Animated.View>
          )}

          <PressableScale
            onPress={handleSubmit}
            disabled={!canSubmit}
            scaleTo={canSubmit ? 0.97 : 1}
            style={[themedStyles.button, !canSubmit && styles.buttonDisabled]}>
            {isSubmitting ? (
              <ActivityIndicator color={theme.textInverse} />
            ) : (
              <ThemedText type="bodySemiBold" themeColor="textInverse">
                Sign in
              </ThemedText>
            )}
          </PressableScale>

          <Link href="/(auth)/sign-up" asChild>
            <Pressable style={styles.linkRow}>
              <ThemedText themeColor="textMuted" type="small">
                No account? <ThemedText type="small" themeColor="accentHover">Create one</ThemedText>
              </ThemedText>
            </Pressable>
          </Link>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.five },
  form: { gap: Spacing.four },
  header: { gap: Spacing.two, marginBottom: Spacing.three },
  title: { marginTop: Spacing.two },
  fields: { gap: Spacing.three },
  buttonDisabled: { opacity: 0.4 },
  linkRow: { alignItems: 'center', paddingVertical: Spacing.two },
});

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.backgroundElement,
    },
    button: {
      backgroundColor: theme.accent,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.three,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
