import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useSettings } from '@/hooks/use-settings';
import { useAuth } from '@/state/auth-context';
import { ImageProvider, LlmProvider, setImageProvider, setLlmProvider } from '@/state/settings-store';

const LLM_OPTIONS: { id: LlmProvider; label: string; hint: string }[] = [
  { id: 'openai', label: 'OpenAI', hint: 'gpt-4o-mini' },
  { id: 'anthropic', label: 'Anthropic', hint: 'Claude Sonnet 5' },
  { id: 'gemini', label: 'Google', hint: 'Gemini 2.5 Flash' },
];

const IMAGE_OPTIONS: { id: ImageProvider; label: string; hint: string }[] = [
  { id: 'openai', label: 'OpenAI', hint: 'gpt-image-1' },
  { id: 'gemini', label: 'Google', hint: 'Gemini 2.5 Flash Image' },
];

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { llmProvider, imageProvider } = useSettings();

  function handleSignOut() {
    Alert.alert('Sign out', `Signed in as ${session?.user.email}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={Colors.light.textMuted} />
          </Pressable>
          <ThemedText type="displaySm">Settings</ThemedText>
          <View style={{ width: 20 }} />
        </View>

        <View style={styles.section}>
          <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
            Language model
          </ThemedText>
          <ThemedText type="small" themeColor="textMuted" style={styles.sectionHint}>
            Used for generating structured knowledge and chat. Search itself always uses
            OpenAI regardless of this choice — Claude has no embeddings API — so an
            OpenAI key is required either way.
          </ThemedText>
          <View style={styles.optionGroup}>
            {LLM_OPTIONS.map((option) => {
              const active = option.id === llmProvider;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setLlmProvider(option.id)}
                  style={[styles.optionRow, active && styles.optionRowActive]}>
                  <View style={styles.optionText}>
                    <ThemedText type="bodySemiBold">{option.label}</ThemedText>
                    <ThemedText type="small" themeColor="textMuted">
                      {option.hint}
                    </ThemedText>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={Colors.light.accent} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
            Image generation
          </ThemedText>
          <View style={styles.optionGroup}>
            {IMAGE_OPTIONS.map((option) => {
              const active = option.id === imageProvider;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setImageProvider(option.id)}
                  style={[styles.optionRow, active && styles.optionRowActive]}>
                  <View style={styles.optionText}>
                    <ThemedText type="bodySemiBold">{option.label}</ThemedText>
                    <ThemedText type="small" themeColor="textMuted">
                      {option.hint}
                    </ThemedText>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={Colors.light.accent} />}
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="small" themeColor="textFaint" style={styles.sectionHint}>
            Claude has no image generation API, so this is independent of the language
            model choice above.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
            Account
          </ThemedText>
          <ThemedText type="body" style={styles.sectionHint}>
            {session?.user.email}
          </ThemedText>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
            <ThemedText type="bodySemiBold" themeColor="danger">
              Sign out
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  section: { marginTop: Spacing.five },
  sectionLabel: { marginBottom: Spacing.one },
  sectionHint: { marginBottom: Spacing.three },
  optionGroup: { gap: Spacing.two },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    backgroundColor: Colors.light.backgroundElement,
  },
  optionRowActive: { borderColor: Colors.light.accent },
  optionText: { gap: 2 },
  signOutButton: {
    marginTop: Spacing.two,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  pressed: { opacity: 0.7 },
});
