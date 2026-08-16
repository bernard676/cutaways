import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logomark } from '@/components/logomark';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/state/auth-context';

export default function SignInScreen() {
  const { signInWithPassword } = useAuth();
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
          <ThemedView style={styles.header}>
            <Logomark size={32} />
            <ThemedText type="display" style={styles.title}>
              Visualpedia
            </ThemedText>
            <ThemedText themeColor="textMuted" type="body">
              Search anything. See how it works.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.fields}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={Colors.light.textFaint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={Colors.light.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              style={styles.input}
            />
          </ThemedView>

          {error && (
            <ThemedText themeColor="danger" type="small">
              {error}
            </ThemedText>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && canSubmit && styles.buttonPressed,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color={Colors.light.textInverse} />
            ) : (
              <ThemedText type="bodySemiBold" themeColor="textInverse">
                Sign in
              </ThemedText>
            )}
          </Pressable>

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
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundElement,
  },
  button: {
    backgroundColor: Colors.light.accent,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.4 },
  linkRow: { alignItems: 'center', paddingVertical: Spacing.two },
});
