import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, ThemeColors } from '@/constants/theme';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { LlmProvider } from '@/state/settings-store';

const LABELS: Record<LlmProvider, string> = { openai: 'OpenAI', anthropic: 'Claude', gemini: 'Gemini' };

/** Always-visible, read-only current-model indicator -- the model in use is visible before,
 * during, and after a search, not just buried in Settings. */
export function ModelBadge() {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const { llmProvider } = useSettings();

  return (
    <View style={themedStyles.badge}>
      <ThemedText type="mono" themeColor="accentHover">
        {LABELS[llmProvider]}
      </ThemedText>
    </View>
  );
}

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    badge: {
      backgroundColor: theme.accentSoft,
      borderRadius: Radii.full,
      paddingHorizontal: Spacing.two,
      paddingVertical: 3,
      alignSelf: 'flex-start',
    },
  });
}
