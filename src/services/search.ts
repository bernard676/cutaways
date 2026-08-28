import { embedText } from '@/lib/ai/embeddings';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { Rpc, Tables } from '@/lib/tables';
import { TopicSearchResult } from '@/types/knowledge';

interface SearchTopicsRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  similarity?: number;
}

const SEMANTIC_MATCH_THRESHOLD = 0.75;
const RESULT_LIMIT = 10;

/**
 * Semantic search needs OpenAI for embeddings even when Claude is selected for everything
 * else (Anthropic has no embeddings API). That must never take down search entirely for
 * someone who only configured an Anthropic key -- if it fails for any reason, fall back to
 * keyword-only results instead of throwing.
 */
async function trySemanticSearch(query: string): Promise<SearchTopicsRow[]> {
  try {
    const embedding = await embedText(query);
    const { data, error } = await supabase.rpc(Rpc.matchTopics, {
      query_embedding: embedding,
      match_threshold: SEMANTIC_MATCH_THRESHOLD,
      match_count: RESULT_LIMIT,
    });
    if (error) throw error;
    return (data ?? []) as SearchTopicsRow[];
  } catch (err) {
    logger.warn('search', 'Semantic search unavailable, falling back to keyword search', {
      err,
    });
    return [];
  }
}

export async function searchTopics(query: string): Promise<TopicSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [semanticRows, keywordResult] = await Promise.all([
    trySemanticSearch(trimmed),
    supabase
      .from(Tables.topics)
      .select('id, slug, title, description, image_url')
      .textSearch('search_text', trimmed, { type: 'websearch' })
      .limit(RESULT_LIMIT),
  ]);

  // Keyword search is the fallback when semantic search is unavailable, so a silent failure
  // here (bad tsquery, transient DB error) would leave a user with no results and no signal.
  if (keywordResult.error) {
    logger.warn('search', 'Keyword search failed', { err: keywordResult.error });
  }

  const byId = new Map<string, SearchTopicsRow>();
  for (const row of semanticRows) {
    byId.set(row.id, row);
  }
  for (const row of (keywordResult.data ?? []) as SearchTopicsRow[]) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  return Array.from(byId.values())
    .slice(0, RESULT_LIMIT)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      similarity: row.similarity,
    }));
}
