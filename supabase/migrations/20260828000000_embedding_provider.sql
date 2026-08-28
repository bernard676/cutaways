-- Two embedding providers now write into visualpedia_topics.embedding (OpenAI
-- text-embedding-3-small, and Gemini gemini-embedding-001 truncated to 1536). Their vector
-- spaces are not aligned, so a cosine distance between a Gemini row and an OpenAI query is
-- noise. Record which provider produced each row so the duplicate-check can stay within one
-- space; semantic search still ranks across everything (a slightly-worse cross-provider hit
-- beats no hit).

alter table visualpedia_topics
  add column embedding_provider text;

comment on column visualpedia_topics.embedding_provider is
  'Which embeddings model produced `embedding` (''openai'' | ''gemini''). Null for rows written before this column existed or with no embedding at all.';

create index visualpedia_topics_embedding_provider_idx
  on visualpedia_topics (embedding_provider);

-- The post-image hotspot pass writes components.metadata.bbox after generation. The init
-- migration only granted components INSERT (not UPDATE) to authenticated users, so add an
-- UPDATE policy scoped the same way as the INSERT one: the component's topic must belong to
-- the caller. Without this, RLS silently drops the bbox writes (0 rows affected, no error).
create policy "visualpedia_components_update_own_topic" on visualpedia_components
  for update to authenticated
  using (
    exists (
      select 1 from visualpedia_topics t
      where t.id = topic_id and t.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from visualpedia_topics t
      where t.id = topic_id and t.created_by = (select auth.uid())
    )
  );

-- Recreate visualpedia_match_topics with an optional provider filter. Default null keeps the
-- existing call sites (semantic search) unchanged; runGeneration's dedup check passes the
-- current provider so it only compares like-for-like vectors.
drop function if exists visualpedia_match_topics (vector, float, int);

create function visualpedia_match_topics (
  query_embedding vector(1536),
  match_threshold float default 0.75,
  match_count int default 10,
  match_provider text default null
) returns table (
  id uuid,
  slug text,
  title text,
  description text,
  image_url text,
  similarity float
) language sql stable as $$
  select
    visualpedia_topics.id,
    visualpedia_topics.slug,
    visualpedia_topics.title,
    visualpedia_topics.description,
    visualpedia_topics.image_url,
    1 - (visualpedia_topics.embedding <=> query_embedding) as similarity
  from visualpedia_topics
  where visualpedia_topics.embedding is not null
    and (match_provider is null or visualpedia_topics.embedding_provider = match_provider)
    and 1 - (visualpedia_topics.embedding <=> query_embedding) > match_threshold
  order by visualpedia_topics.embedding <=> query_embedding
  limit match_count;
$$;
