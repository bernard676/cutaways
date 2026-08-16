-- Visualpedia initial schema
-- This Supabase project is shared across apps, so every table/type/function/index/policy
-- is prefixed with visualpedia_ to avoid colliding with other apps' schema objects.
--
-- Topics/components/relationships form the structured knowledge graph.
-- Generations track the async AI pipeline. Bookmarks/history/chat are user-scoped.

create extension if not exists vector;
create extension if not exists pg_trgm;

create type visualpedia_relationship_type as enum (
  'partOf',
  'connectedTo',
  'supports',
  'transfersLoadTo',
  'madeOf',
  'powers',
  'causes'
);

create type visualpedia_generation_status as enum (
  'pending',
  'understanding',
  'knowledge',
  'components',
  'image',
  'finalizing',
  'complete',
  'failed'
);

-- ---------------------------------------------------------------------------
-- visualpedia_topics
-- ---------------------------------------------------------------------------
create table visualpedia_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  domain text,
  -- overview, materials, construction/manufacturing steps, science/engineering,
  -- failure_modes, sources, related_topic_slugs -- see src/types/knowledge.ts
  structured_knowledge jsonb not null default '{}'::jsonb,
  image_url text,
  image_storage_path text,
  -- OpenAI text-embedding-3-small dimension; revisit if the embedding provider changes.
  embedding vector(1536),
  search_text tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visualpedia_topics_search_text_idx on visualpedia_topics using gin (search_text);
create index visualpedia_topics_embedding_idx on visualpedia_topics using hnsw (embedding vector_cosine_ops);
create index visualpedia_topics_domain_idx on visualpedia_topics (domain);
create index visualpedia_topics_created_by_idx on visualpedia_topics (created_by);

-- ---------------------------------------------------------------------------
-- visualpedia_components
-- ---------------------------------------------------------------------------
create table visualpedia_components (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references visualpedia_topics (id) on delete cascade,
  name text not null,
  description text not null default '',
  purpose text not null default '',
  materials text[] not null default '{}',
  -- e.g. { "bbox": { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.15 } } (normalized 0-1)
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index visualpedia_components_topic_id_idx on visualpedia_components (topic_id);

-- ---------------------------------------------------------------------------
-- visualpedia_relationships
-- ---------------------------------------------------------------------------
create table visualpedia_relationships (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references visualpedia_topics (id) on delete cascade,
  from_component_id uuid not null references visualpedia_components (id) on delete cascade,
  to_component_id uuid not null references visualpedia_components (id) on delete cascade,
  type visualpedia_relationship_type not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index visualpedia_relationships_topic_id_idx on visualpedia_relationships (topic_id);
create index visualpedia_relationships_from_component_idx on visualpedia_relationships (from_component_id);
create index visualpedia_relationships_to_component_idx on visualpedia_relationships (to_component_id);

-- ---------------------------------------------------------------------------
-- visualpedia_generations
-- ---------------------------------------------------------------------------
create table visualpedia_generations (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references visualpedia_topics (id) on delete set null,
  query text not null,
  status visualpedia_generation_status not null default 'pending',
  error text,
  created_by uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visualpedia_generations_created_by_idx on visualpedia_generations (created_by);
create index visualpedia_generations_topic_id_idx on visualpedia_generations (topic_id);

-- ---------------------------------------------------------------------------
-- visualpedia_bookmarks
-- ---------------------------------------------------------------------------
create table visualpedia_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references visualpedia_topics (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, topic_id)
);

create index visualpedia_bookmarks_user_id_idx on visualpedia_bookmarks (user_id);
create index visualpedia_bookmarks_topic_id_idx on visualpedia_bookmarks (topic_id);

-- ---------------------------------------------------------------------------
-- visualpedia_search_history
-- ---------------------------------------------------------------------------
create table visualpedia_search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  query text not null,
  topic_id uuid references visualpedia_topics (id) on delete set null,
  created_at timestamptz not null default now()
);

create index visualpedia_search_history_user_id_idx on visualpedia_search_history (user_id, created_at desc);
create index visualpedia_search_history_topic_id_idx on visualpedia_search_history (topic_id);

-- ---------------------------------------------------------------------------
-- visualpedia_chat_messages
-- ---------------------------------------------------------------------------
create table visualpedia_chat_messages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references visualpedia_topics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  component_context_id uuid references visualpedia_components (id) on delete set null,
  created_at timestamptz not null default now()
);

create index visualpedia_chat_messages_topic_user_idx on visualpedia_chat_messages (topic_id, user_id, created_at);
create index visualpedia_chat_messages_user_id_idx on visualpedia_chat_messages (user_id);
create index visualpedia_chat_messages_component_context_idx on visualpedia_chat_messages (component_context_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create function visualpedia_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger visualpedia_topics_set_updated_at before update on visualpedia_topics
  for each row execute function visualpedia_set_updated_at();

create trigger visualpedia_generations_set_updated_at before update on visualpedia_generations
  for each row execute function visualpedia_set_updated_at();

-- ---------------------------------------------------------------------------
-- semantic search RPC
-- ---------------------------------------------------------------------------
create function visualpedia_match_topics (
  query_embedding vector(1536),
  match_threshold float default 0.75,
  match_count int default 10
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
    and 1 - (visualpedia_topics.embedding <=> query_embedding) > match_threshold
  order by visualpedia_topics.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table visualpedia_topics enable row level security;
alter table visualpedia_components enable row level security;
alter table visualpedia_relationships enable row level security;
alter table visualpedia_generations enable row level security;
alter table visualpedia_bookmarks enable row level security;
alter table visualpedia_search_history enable row level security;
alter table visualpedia_chat_messages enable row level security;

-- Knowledge graph is readable by any signed-in user. All writes go through
-- Edge Functions using the service-role key, which bypasses RLS, so no
-- insert/update/delete policies are defined here.
create policy "visualpedia_topics_select_authenticated" on visualpedia_topics
  for select to authenticated using (true);

create policy "visualpedia_components_select_authenticated" on visualpedia_components
  for select to authenticated using (true);

create policy "visualpedia_relationships_select_authenticated" on visualpedia_relationships
  for select to authenticated using (true);

create policy "visualpedia_generations_select_own" on visualpedia_generations
  for select to authenticated using ((select auth.uid()) = created_by);

create policy "visualpedia_bookmarks_select_own" on visualpedia_bookmarks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "visualpedia_bookmarks_insert_own" on visualpedia_bookmarks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "visualpedia_bookmarks_delete_own" on visualpedia_bookmarks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "visualpedia_search_history_select_own" on visualpedia_search_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "visualpedia_search_history_insert_own" on visualpedia_search_history
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "visualpedia_search_history_delete_own" on visualpedia_search_history
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "visualpedia_chat_messages_select_own" on visualpedia_chat_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "visualpedia_chat_messages_insert_own" on visualpedia_chat_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('visualpedia-topic-images', 'visualpedia-topic-images', true)
on conflict (id) do nothing;

create policy "visualpedia_topic_images_public_read" on storage.objects
  for select using (bucket_id = 'visualpedia-topic-images');

-- ---------------------------------------------------------------------------
-- realtime (generation progress is streamed to the client via postgres_changes)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table visualpedia_generations;
