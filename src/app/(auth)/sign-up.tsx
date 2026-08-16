import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logomark } from '@/components/logomark';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';

export default function SignUpScreen() {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const { signUpWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    const { error: signUpError } = await signUpWithPassword(email.trim(), password);
    setIsSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    setInfo('Check your email to confirm your account, then sign in.');
  }

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !isSubmitting;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.form}>
          <ThemedView style={styles.header}>
            <Logomark size={32} />
            <ThemedText type="display" style={styles.title}>
              Create account
            </ThemedText>
            <ThemedText themeColor="textMuted" type="body">
              Start exploring how things work.
            </ThemedText>
          </ThemedView>

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
              placeholder="Password (min 6 characters)"
              placeholderTextColor={theme.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              style={themedStyles.input}
            />
          </ThemedView>

          {error && (
            <ThemedText themeColor="danger" type="small">
              {error}
            </ThemedText>
          )}
          {info && (
            <ThemedText themeColor="accentHover" type="small">
              {info}
            </ThemedText>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              themedStyles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && canSubmit && styles.buttonPressed,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color={theme.textInverse} />
            ) : (
              <ThemedText type="bodySemiBold" themeColor="textInverse">
                Create account
              </ThemedText>
            )}
          </Pressable>

          <Link href="/(auth)/sign-in" replace asChild>
            <Pressable style={styles.linkRow}>
              <ThemedText themeColor="textMuted" type="small">
                Already have an account? <ThemedText type="small" themeColor="accentHover">Sign in</ThemedText>
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
  buttonPressed: { opacity: 0.85 },
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
