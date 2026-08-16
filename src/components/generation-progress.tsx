import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Spacing, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { GenerationPhase } from '@/hooks/use-generation';

const STEPS: { phase: Exclude<GenerationPhase, 'idle' | 'pending' | 'complete' | 'failed'>; label: string }[] = [
  { phase: 'understanding', label: 'Understanding your question' },
  { phase: 'knowledge', label: 'Retrieving reliable knowledge' },
  { phase: 'components', label: 'Identifying components & relationships' },
  { phase: 'image', label: 'Generating technical cutaway' },
  { phase: 'finalizing', label: 'Preparing your explanation' },
];

function stepIndexFor(phase: GenerationPhase): number {
  if (phase === 'idle' || phase === 'pending') return -1;
  if (phase === 'complete' || phase === 'failed') return STEPS.length;
  return STEPS.findIndex((step) => step.phase === phase);
}

function PulsingDot() {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.6, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1
    );
  }, [scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={[themedStyles.pulseDot, style]} />;
}

export function GenerationProgress({ phase }: { phase: GenerationPhase }) {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const currentIndex = stepIndexFor(phase);
  const progressPct = ((Math.max(currentIndex, 0) / STEPS.length) * 100) | 0;

  return (
    <View style={styles.container}>
      <ProgressBar progress={progressPct} />

      <View style={styles.steps}>
        {STEPS.map((step, index) => {
          const isDone = index < currentIndex || phase === 'complete';
          const isActive = index === currentIndex && phase !== 'complete';

          return (
            <View key={step.phase} style={styles.row}>
              <View
                style={[
                  styles.ring,
                  isDone && themedStyles.ringDone,
                  isActive && themedStyles.ringActive,
                  !isDone && !isActive && themedStyles.ringPending,
                ]}>
                {isDone && <Ionicons name="checkmark" color={theme.statusPassFg} size={13} />}
                {isActive && <PulsingDot />}
              </View>
              <ThemedText
                type={isActive ? 'bodySemiBold' : 'body'}
                themeColor={isDone || isActive ? 'text' : 'textFaint'}>
                {step.label}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.five },
  steps: { gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    ringDone: { borderColor: theme.statusPassFg, backgroundColor: theme.statusPassBg },
    ringActive: { borderColor: theme.text, backgroundColor: theme.backgroundSunken },
    ringPending: { borderColor: theme.border },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.text },
  });
}
