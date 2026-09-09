import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Spacing, ThemeColors } from '@/constants/theme';
import { SPRING_MOMENTUM, STAGGER } from '@/lib/motion';
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
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    // No slow looping oscillation under reduced motion (apple-design §14).
    if (reduced) return;
    scale.set(
      withRepeat(withSequence(withTiming(1.6, { duration: 700 }), withTiming(1, { duration: 700 })), -1)
    );
  }, [scale, reduced]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return <Animated.View style={[themedStyles.pulseDot, style]} />;
}

function DoneCheck({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!reduced) scale.set(withSpring(1, SPRING_MOMENTUM));
  }, [scale, reduced]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={style}>
      <Ionicons name="checkmark" color={color} size={13} />
    </Animated.View>
  );
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
            <Animated.View
              key={step.phase}
              entering={FadeInDown.duration(220).delay(index * STAGGER)}
              style={styles.row}>
              <View
                style={[
                  styles.ring,
                  isDone && themedStyles.ringDone,
                  isActive && themedStyles.ringActive,
                  !isDone && !isActive && themedStyles.ringPending,
                ]}>
                {isDone && <DoneCheck color={theme.statusPassFg} />}
                {isActive && <PulsingDot />}
              </View>
              <ThemedText
                type={isActive ? 'bodySemiBold' : 'body'}
                themeColor={isDone || isActive ? 'text' : 'textFaint'}>
                {step.label}
              </ThemedText>
            </Animated.View>
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
