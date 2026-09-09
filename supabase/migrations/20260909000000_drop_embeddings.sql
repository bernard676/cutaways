-- Semantic / vector search is removed from the app. The text pipeline moved to Claude, which
-- has no embeddings API, and the embeddings feature (dedup, semantic search, "Suggested
-- topics") is being reintroduced later via a different mechanism. Until then, drop the pgvector
-- surface so the schema matches the app: keyword full-text search (visualpedia_topics.search_text)
-- is the only search path now.
--
-- Reversible: a future migration re-adds the column, an index, and whatever RPC the new
-- approach needs. The `vector` extension is left installed (it's shared across apps in this
-- project and cheap to keep).

drop function if exists visualpedia_related_topics (uuid[], int);
drop function if exists visualpedia_match_topics (vector, float, int, text);
drop function if exists visualpedia_match_topics (vector, float, int);

drop index if exists visualpedia_topics_embedding_idx;
drop index if exists visualpedia_topics_embedding_provider_idx;

alter table visualpedia_topics drop column if exists embedding_provider;
alter table visualpedia_topics drop column if exists embedding;
