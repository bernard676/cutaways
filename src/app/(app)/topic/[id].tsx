import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatSheet } from '@/components/chat-sheet';
import { ComponentDetailSheet } from '@/components/component-detail-sheet';
import { FlowChain } from '@/components/flow-chain';
import { GenerationProgress } from '@/components/generation-progress';
import { Tabs } from '@/components/tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ZoomableImage } from '@/components/zoomable-image';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useGeneration } from '@/hooks/use-generation';
import { useToast } from '@/hooks/use-toast';
import { saveImageToLibrary } from '@/lib/download-image';
import { logger } from '@/lib/logger';
import { toSlug } from '@/lib/slug';
import { addBookmark, isBookmarked, removeBookmark } from '@/services/bookmarks';
import { ensureTopicImage } from '@/services/generation';
import { searchTopics } from '@/services/search';
import { getTopicById, getTopicBySlug, TopicDetail } from '@/services/topics';
import { TopicComponent } from '@/types/knowledge';

type TabId = 'components' | 'how' | 'build' | 'engineering' | 'sources';
const TABS: { id: TabId; label: string }[] = [
  { id: 'components', label: 'Components' },
  { id: 'how', label: 'How it works' },
  { id: 'build', label: 'Build' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'sources', label: 'Sources' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

export default function TopicScreen() {
  const { id, breadcrumb: breadcrumbParam } = useLocalSearchParams<{
    id: string;
    breadcrumb?: string;
  }>();
  const breadcrumb: string[] = useMemo(() => {
    try {
      return breadcrumbParam ? JSON.parse(breadcrumbParam) : [];
    } catch (err) {
      logger.error('TopicScreen', 'Failed to parse breadcrumb param', err);
      return [];
    }
  }, [breadcrumbParam]);

  const [selectedComponent, setSelectedComponent] = useState<TopicComponent | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('components');
  const [exploringId, setExploringId] = useState<string | null>(null);

  const componentSheetRef = useRef<BottomSheetModal>(null);
  const chatSheetRef = useRef<BottomSheetModal>(null);
  const exploreGeneration = useGeneration();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: detail,
    isLoading,
    error: loadErrorObj,
  } = useQuery({
    queryKey: ['topic', id],
    queryFn: () => getTopicById(id!),
    enabled: !!id,
  });
  const loadError = loadErrorObj instanceof Error ? loadErrorObj.message : null;

  // Some topics can end up without an image (an earlier generation that failed or was
  // interrupted after saving the topic/components but before the image finished). Backfill
  // and persist one on-demand rather than leaving the page permanently blank.
  const [isBackfillingImage, setIsBackfillingImage] = useState(false);
  const backfillAttemptedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!detail || detail.topic.imageUrl) return;
    if (backfillAttemptedFor.current === detail.topic.id) return;
    backfillAttemptedFor.current = detail.topic.id;

    setIsBackfillingImage(true);
    ensureTopicImage(detail.topic, detail.components)
      .then((imageUrl) => {
        queryClient.setQueryData<TopicDetail>(['topic', id], (prev) =>
          prev ? { ...prev, topic: { ...prev.topic, imageUrl } } : prev
        );
      })
      .catch((err) => {
        logger.error('TopicScreen', 'Failed to backfill topic image', err);
      })
      .finally(() => setIsBackfillingImage(false));
  }, [detail, id, queryClient]);

  const { data: bookmarked = false } = useQuery({
    queryKey: ['bookmarked', id],
    queryFn: () => isBookmarked(id!),
    enabled: !!id,
  });

  useEffect(() => {
    setActiveTab('components');
  }, [id]);

  useEffect(() => {
    if (loadErrorObj) logger.error('TopicScreen', 'Failed to load topic', loadErrorObj);
  }, [loadErrorObj]);

  useEffect(() => {
    if (exploreGeneration.topicId) {
      const topicId = exploreGeneration.topicId;
      const label = exploringId;
      setExploringId(null);
      exploreGeneration.reset();
      componentSheetRef.current?.dismiss();
      pushTopic(topicId, label ?? undefined);
    }
  }, [exploreGeneration.topicId]);

  useEffect(() => {
    if (exploreGeneration.error) {
      showToast(exploreGeneration.error);
      setExploringId(null);
      exploreGeneration.reset();
    }
  }, [exploreGeneration.error]);

  function cancelExploration() {
    setExploringId(null);
    exploreGeneration.reset();
  }

  function pushTopic(topicId: string, _fromLabel?: string) {
    const nextBreadcrumb = detail ? [...breadcrumb, detail.topic.title] : breadcrumb;
    router.push({
      pathname: '/topic/[id]',
      params: { id: topicId, breadcrumb: JSON.stringify(nextBreadcrumb) },
    });
  }

  function openComponent(component: TopicComponent) {
    setSelectedComponent(component);
    componentSheetRef.current?.present();
  }

  const [isDownloadingImage, setIsDownloadingImage] = useState(false);

  async function handleDownloadImage() {
    if (!detail?.topic.imageUrl || isDownloadingImage) return;
    setIsDownloadingImage(true);
    try {
      await saveImageToLibrary(detail.topic.imageUrl, `${detail.topic.slug}.png`);
      showToast('Saved to Photos');
    } catch (err) {
      logger.error('TopicScreen', 'Failed to save image', err);
      showToast(err instanceof Error ? err.message : 'Failed to save image');
    } finally {
      setIsDownloadingImage(false);
    }
  }

  async function handleToggleBookmark() {
    if (!detail) return;
    const next = !bookmarked;
    queryClient.setQueryData(['bookmarked', id], next);
    try {
      if (next) await addBookmark(detail.topic.id);
      else await removeBookmark(detail.topic.id);
      showToast(next ? 'Saved to bookmarks' : 'Removed from bookmarks');
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    } catch (err) {
      logger.error('TopicScreen', 'Failed to toggle bookmark', err);
      queryClient.setQueryData(['bookmarked', id], !next);
    }
  }

  async function exploreByName(explorationId: string, name: string) {
    setExploringId(explorationId);
    try {
      const slug = toSlug(name);
      const existing = await getTopicBySlug(slug);
      if (existing) {
        setExploringId(null);
        componentSheetRef.current?.dismiss();
        pushTopic(existing.id);
        return;
      }

      const matches = await searchTopics(name);
      if (matches.length > 0) {
        setExploringId(null);
        componentSheetRef.current?.dismiss();
        pushTopic(matches[0].id);
        return;
      }

      await exploreGeneration.start(name);
    } catch (err) {
      logger.error('TopicScreen', 'Failed to explore component', err);
      setExploringId(null);
    }
  }

  function handleExploreComponent(component: TopicComponent) {
    exploreByName(component.id, component.name);
  }

  function handleAskAboutComponent(component: TopicComponent) {
    setSelectedComponent(component);
    componentSheetRef.current?.dismiss();
    chatSheetRef.current?.present();
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={Colors.light.accent} />
      </ThemedView>
    );
  }

  if (loadError || !detail) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="danger">{loadError ?? 'Topic not found'}</ThemedText>
      </ThemedView>
    );
  }

  const { topic, components, relationships } = detail;
  const knowledge = topic.structuredKnowledge;
  const isMinimal = components.length === 0;
  const trail = ['Home', ...breadcrumb, topic.title].join('   ›   ');

  const hotspots = components
    .filter((c) => c.metadata.bbox)
    .map((c) => ({
      bbox: c.metadata.bbox!,
      label: c.name,
      onPress: () => openComponent(c),
    }));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" color={Colors.light.textMuted} size={20} />
          </Pressable>
          <ThemedText type="mono" themeColor="textFaint" numberOfLines={1} style={styles.breadcrumb}>
            {trail}
          </ThemedText>
          <Pressable onPress={handleToggleBookmark} hitSlop={8}>
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              color={bookmarked ? Colors.light.accent : Colors.light.text}
              size={19}
            />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.centerColumn}>
            <View style={styles.heroWrap}>
              {topic.imageUrl ? (
                <>
                  <ZoomableImage uri={topic.imageUrl} aspectRatio={4 / 3} hotspots={hotspots} />
                  <Pressable
                    onPress={handleDownloadImage}
                    disabled={isDownloadingImage}
                    hitSlop={8}
                    style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}>
                    {isDownloadingImage ? (
                      <ActivityIndicator size="small" color={Colors.light.textInverse} />
                    ) : (
                      <Ionicons name="download-outline" size={18} color={Colors.light.textInverse} />
                    )}
                  </Pressable>
                </>
              ) : (
                <View style={[styles.heroPlaceholder, { aspectRatio: 4 / 3 }]}>
                  {isBackfillingImage ? (
                    <>
                      <ActivityIndicator color={Colors.light.accent} />
                      <ThemedText type="small" themeColor="textMuted">
                        Generating image…
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText type="small" themeColor="textMuted">
                      Image unavailable
                    </ThemedText>
                  )}
                </View>
              )}
            </View>

            <View style={styles.section}>
              {topic.domain && (
                <View style={styles.domainBadge}>
                  <ThemedText type="small" themeColor="accentHover">
                    {topic.domain}
                  </ThemedText>
                </View>
              )}
              <ThemedText type="display" style={styles.titleText}>
                {topic.title}
              </ThemedText>
              <ThemedText themeColor="textSecondary" type="bodyLg">
                {topic.description}
              </ThemedText>
            </View>

            {isMinimal ? (
              <View style={styles.section}>
                <Section title="What it is">
                  <ThemedText type="body">{topic.description}</ThemedText>
                </Section>
                {knowledge.materials.length > 0 && (
                  <Section title="Made of">
                    <ThemedText type="body">
                      {knowledge.materials.map((m) => m.name).join(', ')}
                    </ThemedText>
                  </Section>
                )}
                <Section title="Why it exists">
                  <ThemedText type="body">{knowledge.overview}</ThemedText>
                </Section>
                {knowledge.relatedTopicSlugs.length > 0 && (
                  <Section title="Connects to">
                    <View style={styles.tagRow}>
                      {knowledge.relatedTopicSlugs.map((slug) => (
                        <Pressable
                          key={slug}
                          onPress={() => exploreByName(slug, slug.replace(/-/g, ' '))}
                          style={styles.tag}>
                          <ThemedText type="small" themeColor="accentHover">
                            {slug.replace(/-/g, ' ')}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </Section>
                )}
              </View>
            ) : (
              <>
                <View style={styles.tabsWrap}>
                  <Tabs tabs={TABS} value={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
                </View>

                <Animated.View key={activeTab} entering={FadeIn.duration(180)}>
                {activeTab === 'components' && (
                  <View style={styles.section}>
                    {components.map((component) => (
                      <Pressable
                        key={component.id}
                        onPress={() => openComponent(component)}
                        style={({ pressed }) => [styles.componentCard, pressed && styles.pressed]}>
                        <View style={styles.componentCardText}>
                          <ThemedText type="bodySemiBold">{component.name}</ThemedText>
                          <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
                            {component.does}
                          </ThemedText>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={Colors.light.border} />
                      </Pressable>
                    ))}
                  </View>
                )}

                {activeTab === 'how' && (
                  <View style={styles.section}>
                    {knowledge.flow.length > 0 ? (
                      <FlowChain steps={knowledge.flow} />
                    ) : (
                      <ThemedText themeColor="textMuted">No flow diagram available.</ThemedText>
                    )}
                  </View>
                )}

                {activeTab === 'build' && (
                  <View style={styles.section}>
                    {knowledge.construction.length > 0 && (
                      <>
                        <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
                          Construction sequence
                        </ThemedText>
                        <View style={styles.stepsList}>
                          {knowledge.construction
                            .slice()
                            .sort((a, b) => a.order - b.order)
                            .map((step) => (
                              <View key={step.order} style={styles.stepRow}>
                                <View style={styles.stepNumber}>
                                  <ThemedText type="mono" themeColor="textInverse">
                                    {step.order}
                                  </ThemedText>
                                </View>
                                <View style={styles.stepText}>
                                  <ThemedText type="bodySemiBold">{step.title}</ThemedText>
                                  <ThemedText type="small" themeColor="textMuted">
                                    {step.description}
                                  </ThemedText>
                                </View>
                              </View>
                            ))}
                        </View>
                      </>
                    )}
                    {knowledge.materials.length > 0 && (
                      <>
                        <ThemedText
                          type="label"
                          themeColor="textFaint"
                          style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
                          Materials
                        </ThemedText>
                        <View style={styles.stepsList}>
                          {knowledge.materials.map((material) => (
                            <View key={material.name} style={styles.card}>
                              <View style={styles.materialHeader}>
                                <ThemedText type="bodySemiBold" style={styles.materialName}>
                                  {material.name}
                                </ThemedText>
                                <ThemedText
                                  type="mono"
                                  themeColor="accentHover"
                                  style={styles.materialSpec}>
                                  {material.spec}
                                </ThemedText>
                              </View>
                              <ThemedText type="small" themeColor="textMuted">
                                {material.why}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                )}

                {activeTab === 'engineering' && (
                  <View style={styles.section}>
                    <ThemedText type="label" themeColor="textFaint" style={styles.sectionLabel}>
                      The physics
                    </ThemedText>
                    <ThemedText type="body" style={styles.principle}>
                      {knowledge.science.principle}
                    </ThemedText>
                    <View style={styles.formulaBlock}>
                      <ThemedText type="mono" themeColor="textInverse" style={styles.formulaText}>
                        {knowledge.science.formula}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textMuted" style={styles.formulaNote}>
                      {knowledge.science.formulaNote}
                    </ThemedText>

                    {knowledge.failureModes.length > 0 && (
                      <>
                        <ThemedText
                          type="label"
                          themeColor="textFaint"
                          style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
                          Common failures
                        </ThemedText>
                        <View style={styles.stepsList}>
                          {knowledge.failureModes.map((failure) => (
                            <View key={failure.name} style={styles.card}>
                              <ThemedText type="bodySemiBold" style={styles.failureName}>
                                {failure.name}
                              </ThemedText>
                              <ThemedText type="small" themeColor="textMuted">
                                <ThemedText type="small" themeColor="text">
                                  Cause —{' '}
                                </ThemedText>
                                {failure.cause}
                              </ThemedText>
                              <ThemedText type="small" themeColor="textMuted">
                                <ThemedText type="small" themeColor="text">
                                  Mitigation —{' '}
                                </ThemedText>
                                {failure.mitigation}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                )}

                {activeTab === 'sources' && (
                  <View style={styles.section}>
                    {knowledge.sources.map((source, index) => (
                      <View key={index} style={styles.sourceRow}>
                        <View style={styles.sourceText}>
                          <ThemedText type="bodyMedium">{source.title}</ThemedText>
                          <ThemedText type="mono" themeColor="textMuted">
                            {source.publisher}
                          </ThemedText>
                        </View>
                        <View style={styles.verifiedBadge}>
                          <ThemedText type="small" themeColor="statusPassFg">
                            Verified
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                </Animated.View>
              </>
            )}
          </View>
        </ScrollView>

        <Pressable onPress={() => chatSheetRef.current?.present()} style={styles.chatFab}>
          <Ionicons name="chatbubbles" color={Colors.light.textInverse} size={22} />
        </Pressable>
      </SafeAreaView>

      <ComponentDetailSheet
        ref={componentSheetRef}
        component={selectedComponent}
        components={components}
        relationships={relationships}
        onExplore={handleExploreComponent}
        onAskAboutComponent={handleAskAboutComponent}
        isExploring={!!selectedComponent && exploringId === selectedComponent.id}
      />
      <ChatSheet
        ref={chatSheetRef}
        topicId={topic.id}
        topicTitle={topic.title}
        selectedComponent={selectedComponent}
        onClose={() => chatSheetRef.current?.dismiss()}
      />

      {exploringId && exploreGeneration.phase !== 'idle' && (
        <View style={styles.exploreOverlay}>
          <ThemedView type="backgroundElement" style={styles.exploreCard}>
            <Pressable onPress={cancelExploration} hitSlop={8} style={styles.exploreCardClose}>
              <Ionicons name="close" size={18} color={Colors.light.textMuted} />
            </Pressable>
            <GenerationProgress phase={exploreGeneration.phase} />
          </ThemedView>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  breadcrumb: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingBottom: Spacing.six * 2 },
  centerColumn: { width: '100%', maxWidth: MaxContentWidth },
  heroWrap: { position: 'relative' },
  downloadButton: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholder: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
  },
  section: { paddingHorizontal: Spacing.four, marginTop: Spacing.four, gap: Spacing.three },
  domainBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.accentSoft,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: 3,
  },
  titleText: { marginTop: 2 },
  sectionLabel: {},
  sectionLabelSpaced: { marginTop: Spacing.four },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tag: {
    backgroundColor: Colors.light.accentSoft,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  tabsWrap: { marginTop: Spacing.four, paddingHorizontal: Spacing.four },
  componentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  componentCardText: { flex: 1, gap: 2, paddingRight: Spacing.two },
  pressed: { opacity: 0.7 },
  stepsList: { gap: Spacing.three },
  stepRow: { flexDirection: 'row', gap: Spacing.three },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepText: { flex: 1, gap: 2 },
  card: {
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.md,
    padding: Spacing.three,
    gap: 4,
  },
  materialHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: Spacing.two,
    rowGap: 2,
  },
  materialName: { flexShrink: 1 },
  materialSpec: { flexShrink: 1, textAlign: 'right' },
  principle: { marginBottom: Spacing.one },
  formulaBlock: {
    backgroundColor: Colors.light.backgroundInverse,
    borderRadius: Radii.md,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  formulaText: { fontSize: 18 },
  formulaNote: { marginTop: Spacing.one },
  failureName: { marginBottom: 2 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  sourceText: { gap: 2, flex: 1, paddingRight: Spacing.two },
  verifiedBadge: {
    backgroundColor: Colors.light.statusPassBg,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  chatFab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  exploreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.light.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreCard: {
    width: '85%',
    maxWidth: 340,
    borderRadius: Radii.xl,
    padding: Spacing.five,
  },
  exploreCardClose: { alignSelf: 'flex-end', marginBottom: Spacing.two, marginTop: -Spacing.two, marginRight: -Spacing.two },
});
