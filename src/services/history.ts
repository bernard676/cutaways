import { mapTopic, Row } from '@/lib/db-mappers';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/tables';
import { Topic } from '@/types/knowledge';

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
