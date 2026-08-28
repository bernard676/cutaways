import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radii, Spacing, ThemeColors } from '@/constants/theme';
import { useSettings } from '@/hooks/use-settings';
import { useTheme, useThemePreference } from '@/hooks/use-theme';
import { ANTHROPIC_TEXT_MODEL, GEMINI_TEXT_MODEL, OPENAI_TEXT_MODEL } from '@/lib/ai/llm';
import { GEMINI_IMAGE_MODEL, OPENAI_IMAGE_MODEL } from '@/lib/ai/image';
import { useAuth } from '@/state/auth-context';
import { ImageProvider, LlmProvider } from '@/state/settings-store';
import { setThemePreference, ThemePreference } from '@/state/theme-store';

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

// The exact model name each provider is actually resolving to right now -- read straight from
// the same constants the fetch calls use, so this can never drift into a friendly-but-wrong
// guess when an EXPO_PUBLIC_*_MODEL env override is set.
const LLM_INFO: Record<LlmProvider, { label: string; hint: string }> = {
  openai: { label: 'OpenAI', hint: OPENAI_TEXT_MODEL },
  anthropic: { label: 'Anthropic', hint: ANTHROPIC_TEXT_MODEL },
  gemini: { label: 'Google', hint: GEMINI_TEXT_MODEL },
};

const IMAGE_INFO: Record<ImageProvider, { label: string; hint: string }> = {
  openai: { label: 'OpenAI', hint: OPENAI_IMAGE_MODEL },
  gemini: { label: 'Google', hint: GEMINI_IMAGE_MODEL },
};

/** No username field exists in auth -- derive a friendly display name from the email's local part. */
function deriveDisplayName(email: string): string {
  const localPart = email.split('@')[0] ?? email;
  return localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function formatJoinedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { llmProvider, imageProvider } = useSettings();
  const themePreference = useThemePreference();
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);

  const email = session?.user.email ?? null;
  const displayName = email ? deriveDisplayName(email) : null;
  const joinedDate = session?.user.created_at ? formatJoinedDate(session.user.created_at) : null;

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
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
          </Pressable>
          <ThemedText type="displaySm">Settings</ThemedText>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
              Appearance
            </ThemedText>
            <View style={styles.optionGroup}>
              {THEME_OPTIONS.map((option) => {
                const active = option.id === themePreference;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setThemePreference(option.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${option.label} theme`}
                    style={[themedStyles.optionRow, active && themedStyles.optionRowActive]}>
                    <ThemedText type="bodySemiBold">{option.label}</ThemedText>
                    {active && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
              Language model
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted" style={styles.sectionHint}>
              Used for generating structured knowledge and chat. Search uses this provider's
              embeddings too, except Anthropic (no embeddings API) which falls back to OpenAI.
            </ThemedText>
            <View style={themedStyles.infoRow}>
              <View style={styles.optionText}>
                <ThemedText type="bodySemiBold">{LLM_INFO[llmProvider].label}</ThemedText>
                <ThemedText type="small" themeColor="textMuted">
                  {LLM_INFO[llmProvider].hint}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
              Image generation
            </ThemedText>
            <ThemedText type="small" themeColor="textFaint" style={styles.sectionHint}>
              Claude has no image generation API, so this is independent of the language
              model choice above.
            </ThemedText>
            <View style={themedStyles.infoRow}>
              <View style={styles.optionText}>
                <ThemedText type="bodySemiBold">{IMAGE_INFO[imageProvider].label}</ThemedText>
                <ThemedText type="small" themeColor="textMuted">
                  {IMAGE_INFO[imageProvider].hint}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
              Account
            </ThemedText>
            <View style={styles.optionGroup}>
              {displayName && (
                <View style={themedStyles.infoRow}>
                  <Ionicons name="person-circle-outline" size={20} color={theme.textMuted} />
                  <View style={styles.optionText}>
                    <ThemedText type="small" themeColor="textFaint">
                      Name
                    </ThemedText>
                    <ThemedText type="bodySemiBold">{displayName}</ThemedText>
                  </View>
                </View>
              )}
              {email && (
                <View style={themedStyles.infoRow}>
                  <Ionicons name="mail-outline" size={20} color={theme.textMuted} />
                  <View style={styles.optionText}>
                    <ThemedText type="small" themeColor="textFaint">
                      Email
                    </ThemedText>
                    <ThemedText type="bodySemiBold">{email}</ThemedText>
                  </View>
                </View>
              )}
              {joinedDate && (
                <View style={themedStyles.infoRow}>
                  <Ionicons name="calendar-outline" size={20} color={theme.textMuted} />
                  <View style={styles.optionText}>
                    <ThemedText type="small" themeColor="textFaint">
                      Member since
                    </ThemedText>
                    <ThemedText type="bodySemiBold">{joinedDate}</ThemedText>
                  </View>
                </View>
              )}
            </View>
            <Pressable
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={({ pressed }) => [themedStyles.signOutButton, pressed && styles.pressed]}>
              <ThemedText type="bodySemiBold" themeColor="danger">
                Sign out
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
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
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.six },
  section: { marginTop: Spacing.five },
  sectionLabel: { marginBottom: Spacing.one },
  sectionHint: { marginBottom: Spacing.three },
  optionGroup: { gap: Spacing.two },
  optionText: { gap: 2, flex: 1 },
  pressed: { opacity: 0.7 },
});

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      backgroundColor: theme.backgroundElement,
    },
    optionRowActive: { borderColor: theme.accent },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      backgroundColor: theme.backgroundElement,
    },
    signOutButton: {
      marginTop: Spacing.two,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two,
    },
  });
}
