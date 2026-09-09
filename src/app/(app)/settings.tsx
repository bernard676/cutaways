import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radii, Spacing, ThemeColors } from '@/constants/theme';
import { SPRING_MOMENTUM } from '@/lib/motion';
import { haptics } from '@/hooks/use-haptics';
import { useTheme, useThemePreference } from '@/hooks/use-theme';
import { TEXT_MODEL } from '@/lib/ai/llm';
import { IMAGE_MODEL } from '@/lib/ai/image';
import { useAuth } from '@/state/auth-context';
import { setThemePreference, ThemePreference } from '@/state/theme-store';

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

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

/** The selected-state check springs in from nothing when a row becomes active. */
function SelectedCheck({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) scale.set(withSpring(1, SPRING_MOMENTUM));
  }, [reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={style}>
      <Ionicons name="checkmark-circle" size={20} color={color} />
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
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
          <PressableScale
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
          </PressableScale>
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
                  <PressableScale
                    key={option.id}
                    onPress={() => {
                      if (!active) haptics.selection();
                      setThemePreference(option.id);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${option.label} theme`}
                    style={[themedStyles.optionRow, active && themedStyles.optionRowActive]}>
                    <ThemedText type="bodySemiBold">{option.label}</ThemedText>
                    {active && <SelectedCheck key={option.id} color={theme.accent} />}
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
              AI models
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted" style={styles.sectionHint}>
              Structured knowledge and chat run on Claude; the infographic is generated by
              Gemini. Both are fixed in this build.
            </ThemedText>
            <View style={styles.optionGroup}>
              <View style={themedStyles.infoRow}>
                <View style={styles.optionText}>
                  <ThemedText type="bodySemiBold">Knowledge &amp; chat</ThemedText>
                  <ThemedText type="small" themeColor="textMuted">
                    {TEXT_MODEL}
                  </ThemedText>
                </View>
              </View>
              <View style={themedStyles.infoRow}>
                <View style={styles.optionText}>
                  <ThemedText type="bodySemiBold">Infographic</ThemedText>
                  <ThemedText type="small" themeColor="textMuted">
                    {IMAGE_MODEL}
                  </ThemedText>
                </View>
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
            <PressableScale
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={themedStyles.signOutButton}>
              <ThemedText type="bodySemiBold" themeColor="danger">
                Sign out
              </ThemedText>
            </PressableScale>
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
