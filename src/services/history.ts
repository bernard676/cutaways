import { mapTopic, Row } from '@/lib/db-mappers';
import { supabase } from '@/lib/supabase';
import { Rpc, Tables } from '@/lib/tables';
import { Topic, TopicSearchResult } from '@/types/knowledge';

const SUGGESTION_HISTORY_LIMIT = 10;
const SUGGESTION_RESULT_LIMIT = 8;

export interface HistoryEntry {
  id: string;
  query: string;
  createdAt: string;
  topic: Topic | null;
}

export async function addSearchHistory(query: string, topicId: string | null) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  await supabase.from(Tables.searchHistory).insert({ user_id: userId, query, topic_id: topicId });
}

interface HistoryRow {
  id: string;
  query: string;
  created_at: string;
  topic: Row.Topic | null;
}

export async function listSearchHistory(): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from(Tables.searchHistory)
    .select(`id, query, created_at, topic:${Tables.topics}(*)`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  return ((data as unknown as HistoryRow[]) ?? []).map((row) => ({
    id: row.id,
    query: row.query,
    createdAt: row.created_at,
    topic: row.topic ? mapTopic(row.topic) : null,
  }));
}

/** Distinct-by-topic recently viewed topics, most recent first, for the Home screen. */
export async function listRecentTopics(limit = 8): Promise<Topic[]> {
  const { data, error } = await supabase
    .from(Tables.searchHistory)
    .select(`created_at, topic:${Tables.topics}(*)`)
    .not('topic_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;

  const seen = new Set<string>();
  const topics: Topic[] = [];
  for (const row of (data as unknown as { topic: Row.Topic | null }[]) ?? []) {
    if (!row.topic || seen.has(row.topic.id)) continue;
    seen.add(row.topic.id);
    topics.push(mapTopic(row.topic));
    if (topics.length >= limit) break;
  }
  return topics;
}

interface RelatedTopicRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  similarity: number;
}

/**
 * Topics related to the topics behind the user's last 10 searches (by averaged embedding
 * similarity), for the Home screen's "Suggested topics" section. Empty when the user has no
 * resolved search history yet -- the caller falls back to a static default list in that case.
 */
export async function listSuggestedTopics(limit = SUGGESTION_RESULT_LIMIT): Promise<TopicSearchResult[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data: historyRows, error: historyError } = await supabase
    .from(Tables.searchHistory)
    .select('topic_id')
    .eq('user_id', userId)
    .not('topic_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(SUGGESTION_HISTORY_LIMIT);
  if (historyError) throw historyError;

  const seedTopicIds = Array.from(new Set((historyRows ?? []).map((row) => row.topic_id as string)));
  if (seedTopicIds.length === 0) return [];

  const { data, error } = await supabase.rpc(Rpc.relatedTopics, {
    seed_topic_ids: seedTopicIds,
    match_count: limit,
  });
  if (error) throw error;

  return ((data ?? []) as RelatedTopicRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    similarity: row.similarity,
  }));
}
