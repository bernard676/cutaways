import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useSettings } from '@/hooks/use-settings';
import { useToast } from '@/hooks/use-toast';
import { LlmProvider, setLlmProvider } from '@/state/settings-store';

const LABELS: Record<LlmProvider, string> = { openai: 'OpenAI', anthropic: 'Claude', gemini: 'Gemini' };
const NEXT: Record<LlmProvider, LlmProvider> = {
  openai: 'anthropic',
  anthropic: 'gemini',
  gemini: 'openai',
};

/** Always-visible current-model indicator, doubling as a one-tap toggle -- so the model in use
 * is visible (and changeable) before, during, and after a search, not just buried in Settings. */
export function ModelBadge() {
  const { llmProvider } = useSettings();
  const { showToast } = useToast();

  function toggle() {
    const next = NEXT[llmProvider];
    setLlmProvider(next);
    showToast(`Switched to ${LABELS[next]}`);
  }

  return (
    <Pressable onPress={toggle} style={styles.badge} hitSlop={8}>
      <ThemedText type="mono" themeColor="accentHover">
        {LABELS[llmProvider]}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.light.accentSoft,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
});
