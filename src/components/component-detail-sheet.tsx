import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, ThemeColors } from '@/constants/theme';
import { STAGGER } from '@/lib/motion';
import { haptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { ComponentRelationship, TopicComponent } from '@/types/knowledge';

interface ComponentDetailSheetProps {
  component: TopicComponent | null;
  components: TopicComponent[];
  relationships: ComponentRelationship[];
  onExplore?: (component: TopicComponent) => void;
  onAskAboutComponent?: (component: TopicComponent) => void;
  isExploring?: boolean;
}

function Section({
  title,
  index = 0,
  children,
}: {
  title: string;
  index?: number;
  children: React.ReactNode;
}) {
  return (
    <Animated.View style={styles.section} entering={FadeInDown.duration(240).delay(index * STAGGER)}>
      <ThemedText type="label" themeColor="textFaint">
        {title}
      </ThemedText>
      {children}
    </Animated.View>
  );
}

export const ComponentDetailSheet = forwardRef<BottomSheetModal, ComponentDetailSheetProps>(
  function ComponentDetailSheet(
    { component, components, relationships, onExplore, onAskAboutComponent, isExploring },
    ref
  ) {
    const theme = useTheme();
    const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
    const snapPoints = useMemo(() => ['55%', '90%'], []);

    const connections = useMemo(() => {
      if (!component) return [];
      const byId = new Map(components.map((c) => [c.id, c]));
      const seen = new Set<string>();
      const result: TopicComponent[] = [];
      for (const r of relationships) {
        if (r.fromComponentId !== component.id && r.toComponentId !== component.id) continue;
        const otherId = r.fromComponentId === component.id ? r.toComponentId : r.fromComponentId;
        const other = byId.get(otherId);
        if (other && !seen.has(other.id)) {
          seen.add(other.id);
          result.push(other);
        }
      }
      return result;
    }, [component, components, relationships]);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: theme.backgroundElement }}
        handleIndicatorStyle={{ backgroundColor: theme.border }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
        onChange={(i) => {
          if (i >= 0) haptics.impact();
        }}>
        <BottomSheetView style={styles.content}>
          {component && (
            <>
              <ThemedText type="displaySm" style={styles.title}>
                {component.name}
              </ThemedText>

              <Section title="What it is" index={0}>
                <ThemedText type="body">{component.description}</ThemedText>
              </Section>

              <Section title="What it does" index={1}>
                <ThemedText type="body">{component.does}</ThemedText>
              </Section>

              {component.materials.length > 0 && (
                <Section title="Made of" index={2}>
                  <ThemedText type="body">{component.materials.join(', ')}</ThemedText>
                </Section>
              )}

              <Section title="Why it exists" index={3}>
                <ThemedText type="body">{component.why}</ThemedText>
              </Section>

              {connections.length > 0 && (
                <Section title="Connects to" index={4}>
                  <View style={styles.tagRow}>
                    {connections.map((other) => (
                      <View key={other.id} style={themedStyles.tag}>
                        <ThemedText type="small" themeColor="accentHover">
                          {other.name}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </Section>
              )}

              {onExplore && (
                <PressableScale
                  onPress={() => onExplore(component)}
                  disabled={isExploring}
                  haptic="selection"
                  style={themedStyles.primaryButton}>
                  {isExploring ? (
                    <ActivityIndicator color={theme.textInverse} />
                  ) : (
                    <ThemedText type="bodySemiBold" themeColor="textInverse">
                      Generate new sketch for {component.name}
                    </ThemedText>
                  )}
                </PressableScale>
              )}

              {onAskAboutComponent && (
                <PressableScale
                  onPress={() => onAskAboutComponent(component)}
                  haptic="selection"
                  style={themedStyles.secondaryButton}>
                  <ThemedText type="bodySemiBold" themeColor="text">
                    Ask about this
                  </ThemedText>
                </PressableScale>
              )}
            </>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  title: { marginBottom: Spacing.one },
  section: { gap: Spacing.one },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    tag: {
      backgroundColor: theme.accentSoft,
      borderRadius: Radii.full,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
    },
    primaryButton: {
      backgroundColor: theme.accent,
      borderRadius: Radii.md,
      paddingVertical: Spacing.three,
      alignItems: 'center',
      marginTop: Spacing.two,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radii.md,
      paddingVertical: Spacing.three,
      alignItems: 'center',
    },
  });
}
