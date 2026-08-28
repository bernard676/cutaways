-- Related-topics RPC backing the Home screen's "Suggested topics" section: given the topic ids
-- from a user's recent search history, finds topics whose embedding is closest to the average
-- of those seed embeddings, excluding the seeds themselves. Kept as a stable SQL function (same
-- pattern as visualpedia_match_topics) so the embedding vector never has to round-trip through
-- the client -- averaging happens in Postgres. Requires pgvector >= 0.5 for avg(vector), already
-- guaranteed by the HNSW index on visualpedia_topics.embedding created in the init migration.
create function visualpedia_related_topics (
  seed_topic_ids uuid[],
  match_count int default 8
) returns table (
  id uuid,
  slug text,
  title text,
  description text,
  image_url text,
  similarity float
) language sql stable as $$
  with seed as (
    select avg(embedding) as avg_embedding
    from visualpedia_topics
    where id = any(seed_topic_ids) and embedding is not null
  )
  select
    t.id,
    t.slug,
    t.title,
    t.description,
    t.image_url,
    1 - (t.embedding <=> seed.avg_embedding) as similarity
  from visualpedia_topics t, seed
  where seed.avg_embedding is not null
    and t.embedding is not null
    and not (t.id = any(seed_topic_ids))
  order by t.embedding <=> seed.avg_embedding
  limit match_count;
$$;
