import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, ThemeColors } from '@/constants/theme';
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textFaint">
        {title}
      </ThemedText>
      {children}
    </View>
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
        )}>
        <BottomSheetView style={styles.content}>
          {component && (
            <>
              <ThemedText type="displaySm" style={styles.title}>
                {component.name}
              </ThemedText>

              <Section title="What it is">
                <ThemedText type="body">{component.description}</ThemedText>
              </Section>

              <Section title="What it does">
                <ThemedText type="body">{component.does}</ThemedText>
              </Section>

              {component.materials.length > 0 && (
                <Section title="Made of">
                  <ThemedText type="body">{component.materials.join(', ')}</ThemedText>
                </Section>
              )}

              <Section title="Why it exists">
                <ThemedText type="body">{component.why}</ThemedText>
              </Section>

              {connections.length > 0 && (
                <Section title="Connects to">
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
                <Pressable
                  onPress={() => onExplore(component)}
                  disabled={isExploring}
                  style={({ pressed }) => [themedStyles.primaryButton, pressed && styles.pressed]}>
                  {isExploring ? (
                    <ActivityIndicator color={theme.textInverse} />
                  ) : (
                    <ThemedText type="bodySemiBold" themeColor="textInverse">
                      Generate new infographic for {component.name}
                    </ThemedText>
                  )}
                </Pressable>
              )}

              {onAskAboutComponent && (
                <Pressable
                  onPress={() => onAskAboutComponent(component)}
                  style={({ pressed }) => [themedStyles.secondaryButton, pressed && styles.pressed]}>
                  <ThemedText type="bodySemiBold" themeColor="text">
                    Ask about this
                  </ThemedText>
                </Pressable>
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
  pressed: { opacity: 0.85 },
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
