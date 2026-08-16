import { mapTopic, Row } from '@/lib/db-mappers';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/tables';
import { Topic } from '@/types/knowledge';

export interface BookmarkEntry {
  id: string;
  topicId: string;
  createdAt: string;
  topic: Topic;
}

interface BookmarkRow {
  id: string;
  topic_id: string;
  created_at: string;
  topic: Row.Topic;
}

export async function listBookmarks(): Promise<BookmarkEntry[]> {
  const { data, error } = await supabase
    .from(Tables.bookmarks)
    .select(`id, topic_id, created_at, topic:${Tables.topics}(*)`)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data as unknown as BookmarkRow[]) ?? []).map((row) => ({
    id: row.id,
    topicId: row.topic_id,
    createdAt: row.created_at,
    topic: mapTopic(row.topic),
  }));
}

export async function isBookmarked(topicId: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from(Tables.bookmarks)
    .select('id')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function addBookmark(topicId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase
    .from(Tables.bookmarks)
    .insert({ user_id: userId, topic_id: topicId });
  if (error) throw error;
}

export async function removeBookmark(topicId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase
    .from(Tables.bookmarks)
    .delete()
    .eq('user_id', userId)
    .eq('topic_id', topicId);
  if (error) throw error;
}
