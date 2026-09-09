import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/tables';
import { TopicSearchResult } from '@/types/knowledge';

const RESULT_LIMIT = 10;

/**
 * Keyword search over existing topics, backed by the generated `search_text` tsvector column
 * (title + description). Semantic/vector search was removed; it will return via a different
 * mechanism later.
 */
export async function searchTopics(query: string): Promise<TopicSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from(Tables.topics)
    .select('id, slug, title, description, image_url')
    .textSearch('search_text', trimmed, { type: 'websearch' })
    .limit(RESULT_LIMIT);

  if (error) {
    logger.warn('search', 'Keyword search failed', { err: error });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
  }));
}
