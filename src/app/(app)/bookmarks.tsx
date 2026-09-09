import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/lib/logger';
import { listBookmarks } from '@/services/bookmarks';

export default function BookmarksScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const {
    data: bookmarks = [],
    isLoading,
    error,
  } = useQuery({ queryKey: ['bookmarks'], queryFn: () => listBookmarks() });

  useEffect(() => {
    if (error) logger.error('Bookmarks', 'Failed to load bookmarks', error);
  }, [error]);

  // Bookmarking happens from the topic screen, so refresh whenever this screen regains focus.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    }, [queryClient])
  );

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
          <ThemedText type="displaySm">Bookmarks</ThemedText>
          <View style={{ width: 20 }} />
        </View>

        {!isLoading && bookmarks.length === 0 && (
          <Animated.View entering={FadeIn.duration(240)}>
            <ThemedText themeColor="textMuted" style={styles.empty}>
              Topics you save will show up here.
            </ThemedText>
          </Animated.View>
        )}

        {/* Fade the whole list in once on load — rows are virtualized, so no per-row
            `entering` (it re-fires as rows recycle on scroll). */}
        <Animated.View style={styles.listWrap} entering={FadeIn.duration(220)}>
          <FlatList
            data={bookmarks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <PressableScale
                onPress={() => router.push(`/topic/${item.topicId}`)}
                style={styles.row}>
                {item.topic.imageUrl ? (
                  <Image source={{ uri: item.topic.imageUrl }} style={styles.image} />
                ) : (
                  <ThemedView type="backgroundSunken" style={styles.image} />
                )}
                <ThemedView style={styles.text}>
                  <ThemedText type="bodySemiBold">{item.topic.title}</ThemedText>
                  <ThemedText themeColor="textMuted" type="small" numberOfLines={2}>
                    {item.topic.description}
                  </ThemedText>
                </ThemedView>
              </PressableScale>
            )}
          />
        </Animated.View>
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
  empty: { marginTop: Spacing.four },
  listWrap: { flex: 1 },
  list: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  image: { width: 56, height: 56, borderRadius: Radii.md },
  text: { flex: 1, gap: 2 },
});
