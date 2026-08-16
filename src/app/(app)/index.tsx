import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GenerationProgress } from '@/components/generation-progress';
import { Logomark } from '@/components/logomark';
import { ModelBadge } from '@/components/model-badge';
import { SwipeToDismiss } from '@/components/swipe-to-dismiss';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radii, Spacing, ThemeColors } from '@/constants/theme';
import { useGeneration } from '@/hooks/use-generation';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/lib/logger';
import { addSearchHistory, listRecentTopics } from '@/services/history';
import { searchTopics } from '@/services/search';
import { TopicSearchResult } from '@/types/knowledge';

type Mode = 'idle' | 'searching' | 'results' | 'generating' | 'error';

const SUGGESTED_TOPICS = [
  'House foundation',
  'Suspension bridge',
  'Jet engine',
  'Human heart',
  'Lithium-ion battery',
  'Curtain wall bracket',
];

export default function HomeScreen() {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [results, setResults] = useState<TopicSearchResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const generation = useGeneration();
  const queryClient = useQueryClient();

  const { data: recent = [], error: recentError } = useQuery({
    queryKey: ['recentTopics'],
    queryFn: () => listRecentTopics(),
  });

  useEffect(() => {
    if (recentError) logger.error('Home', 'Failed to load recent topics', recentError);
  }, [recentError]);

  // Recent topics change from actions taken on other screens (bookmarking, viewing a topic),
  // so refresh on every return to Home rather than relying on a single mount-time fetch.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['recentTopics'] });
    }, [queryClient])
  );

  useEffect(() => {
    if (generation.topicId) {
      const topicId = generation.topicId;
      generation.reset();
      setMode('idle');
      setQuery('');
      router.push(`/topic/${topicId}`);
    }
  }, [generation.topicId]);

  useEffect(() => {
    if (generation.error) {
      setErrorMessage(generation.error);
      setMode('error');
    }
  }, [generation.error]);

  async function runSearch(explicitQuery?: string) {
    const trimmed = (explicitQuery ?? query).trim();
    if (!trimmed) return;

    setErrorMessage(null);
    setMode('searching');
    try {
      const found = await searchTopics(trimmed);
      if (found.length > 0) {
        setResults(found);
        setMode('results');
      } else {
        await generateNew(trimmed);
      }
    } catch (err) {
      logger.error('Home', 'Search failed', err);
      setErrorMessage(err instanceof Error ? err.message : 'Search failed');
      setMode('error');
    }
  }

  async function generateNew(topicQuery: string) {
    setMode('generating');
    addSearchHistory(topicQuery, null).catch((err) =>
      logger.error('Home', 'Failed to record search history', err)
    );
    await generation.start(topicQuery);
  }

  function cancelGeneration() {
    generation.reset();
    setErrorMessage(null);
    setMode('idle');
  }

  function openResult(result: TopicSearchResult) {
    addSearchHistory(query.trim(), result.id).catch((err) =>
      logger.error('Home', 'Failed to record search history', err)
    );
    setQuery('');
    setMode('idle');
    setResults([]);
    router.push(`/topic/${result.id}`);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {mode !== 'generating' && (
          <ThemedView style={styles.header}>
            <ThemedView style={styles.brandRow}>
              <Logomark />
              <ThemedText type="wordmark">Visualpedia</ThemedText>
            </ThemedView>
            <ThemedView style={styles.headerActions}>
              <ModelBadge />
              <Pressable onPress={() => router.push('/bookmarks')} hitSlop={8} style={styles.headerIcon}>
                <Ionicons name="bookmark-outline" size={19} color={theme.text} />
              </Pressable>
              <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.headerIcon}>
                <Ionicons name="person-circle-outline" size={22} color={theme.text} />
              </Pressable>
            </ThemedView>
          </ThemedView>
        )}

        {mode === 'generating' ? (
          <ThemedView style={styles.generatingWrap}>
            <Pressable onPress={cancelGeneration} style={styles.backButton}>
              <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
            </Pressable>
            <ThemedView style={styles.thinkingRow}>
              <ThemedView style={themedStyles.thinkingDot} />
              <ThemedText type="mono" themeColor="accentHover">
                VISUALPEDIA IS THINKING
              </ThemedText>
            </ThemedView>
            <ThemedText type="displaySm" style={styles.generatingQuery}>
              "{query || generation.phase}"
            </ThemedText>
            <GenerationProgress phase={generation.phase} />
          </ThemedView>
        ) : (
          <FlatList
            data={mode === 'results' ? results : []}
            keyExtractor={(item) => item.id}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            ListHeaderComponent={
              <ThemedView style={styles.centerColumn}>
                {mode === 'idle' && (
                  <ThemedView style={styles.hero}>
                    <ThemedText type="display">What do you want{'\n'}to understand?</ThemedText>
                    <ThemedText themeColor="textMuted" type="body" style={styles.heroSubtitle}>
                      Search any object, structure or system — get a visual, technical breakdown.
                    </ThemedText>
                  </ThemedView>
                )}

                <ThemedView style={themedStyles.searchRow}>
                  <Ionicons name="search" size={17} color={theme.textFaint} />
                  <TextInput
                    value={query}
                    onChangeText={(text) => {
                      setQuery(text);
                      if (mode === 'error' || mode === 'results') {
                        setErrorMessage(null);
                        setMode('idle');
                      }
                    }}
                    onSubmitEditing={() => runSearch()}
                    placeholder='Try "suspension bridge"'
                    placeholderTextColor={theme.textFaint}
                    returnKeyType="search"
                    style={themedStyles.input}
                  />
                  <Pressable onPress={() => runSearch()} style={themedStyles.goButton}>
                    <ThemedText type="bodySemiBold" themeColor="text">
                      Go
                    </ThemedText>
                  </Pressable>
                </ThemedView>

                {mode === 'error' && errorMessage && (
                  <SwipeToDismiss
                    onDismiss={() => {
                      setErrorMessage(null);
                      setMode('idle');
                    }}>
                    <ThemedView style={styles.errorBlock}>
                      <ThemedText themeColor="danger" style={styles.error}>
                        {errorMessage}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textFaint">
                        Swipe to dismiss
                      </ThemedText>
                    </ThemedView>
                  </SwipeToDismiss>
                )}

                {mode === 'searching' && (
                  <ThemedText themeColor="textMuted" style={styles.error}>
                    Searching…
                  </ThemedText>
                )}

                {mode === 'idle' && (
                  <>
                    <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
                      Suggested topics
                    </ThemedText>
                    <ThemedView style={styles.chipRow}>
                      {SUGGESTED_TOPICS.map((label) => (
                        <Pressable
                          key={label}
                          onPress={() => {
                            setQuery(label);
                            runSearch(label);
                          }}
                          style={themedStyles.chip}>
                          <ThemedText type="small">{label}</ThemedText>
                        </Pressable>
                      ))}
                    </ThemedView>

                    {recent.length > 0 && (
                      <>
                        <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
                          Recent
                        </ThemedText>
                        <ThemedView style={styles.recentList}>
                          {recent.map((topic) => (
                            <Pressable
                              key={topic.id}
                              onPress={() => router.push(`/topic/${topic.id}`)}
                              style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}>
                              <ThemedView style={themedStyles.avatar}>
                                <ThemedText type="mono" themeColor="accentHover">
                                  {topic.title[0]}
                                </ThemedText>
                              </ThemedView>
                              <ThemedView style={styles.recentText}>
                                <ThemedText type="bodySemiBold">{topic.title}</ThemedText>
                                <ThemedText type="small" themeColor="textMuted">
                                  {topic.domain}
                                </ThemedText>
                              </ThemedView>
                              <Ionicons name="chevron-forward" size={14} color={theme.border} />
                            </Pressable>
                          ))}
                        </ThemedView>
                      </>
                    )}
                  </>
                )}

                {mode === 'results' && (
                  <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
                    Latest
                  </ThemedText>
                )}
              </ThemedView>
            }
            ListFooterComponent={
              mode === 'results' ? (
                <ThemedView style={styles.centerColumn}>
                  <Pressable
                    onPress={() => generateNew(query.trim())}
                    style={({ pressed }) => [themedStyles.generateButton, pressed && styles.pressed]}>
                    <Ionicons name="sparkles" size={16} color={theme.textInverse} />
                    <ThemedText type="bodySemiBold" themeColor="textInverse">
                      Generate new infographic
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              ) : null
            }
            renderItem={({ item }) => (
              <ThemedView style={styles.centerColumn}>
                <Pressable
                  onPress={() => openResult(item)}
                  style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.resultImage} />
                  ) : (
                    <ThemedView type="backgroundSunken" style={styles.resultImage} />
                  )}
                  <ThemedView style={styles.recentText}>
                    <ThemedText type="bodySemiBold">{item.title}</ThemedText>
                    <ThemedText type="small" themeColor="textMuted" numberOfLines={2}>
                      {item.description}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </ThemedView>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headerIcon: { padding: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.six },
  centerColumn: { paddingHorizontal: Spacing.four },
  hero: { paddingTop: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.two },
  heroSubtitle: { marginTop: Spacing.one },
  error: { marginBottom: Spacing.two, fontSize: 14 },
  errorBlock: { marginBottom: Spacing.three, gap: Spacing.one },
  sectionLabel: { marginBottom: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.five },
  recentList: { gap: Spacing.two },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  recentText: { flex: 1, gap: 2 },
  resultImage: { width: 56, height: 56, borderRadius: Radii.md },
  pressed: { opacity: 0.7 },
  generatingWrap: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  backButton: { alignSelf: 'flex-start', padding: Spacing.two, marginLeft: -Spacing.two, marginBottom: Spacing.two },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.one },
  generatingQuery: { marginBottom: Spacing.five },
});

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radii.lg,
      paddingLeft: Spacing.three,
      paddingRight: Spacing.two,
      paddingVertical: Spacing.two,
      marginBottom: Spacing.five,
    },
    input: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 6 },
    goButton: {
      backgroundColor: theme.backgroundSunken,
      borderRadius: Radii.sm,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
    },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radii.full,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one + 2,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: Radii.md,
      backgroundColor: theme.backgroundSunken,
      alignItems: 'center',
      justifyContent: 'center',
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      backgroundColor: theme.accent,
      borderRadius: Radii.md,
      paddingVertical: Spacing.three,
      marginTop: Spacing.two,
      marginBottom: Spacing.four,
    },
    thinkingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent },
  });
}
