-- The AI generation pipeline now runs client-side (no Edge Functions / service role writes),
-- so authenticated users need direct INSERT/UPDATE access to the shared knowledge tables and
-- the topic-images bucket. Component/relationship inserts are scoped to topics the caller
-- created (not just role membership) to avoid an IDOR where any signed-in user could attach
-- rows to someone else's topic_id.

create policy "visualpedia_topics_insert_authenticated" on visualpedia_topics
  for insert to authenticated with check (true);
create policy "visualpedia_topics_update_own" on visualpedia_topics
  for update to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "visualpedia_components_insert_own_topic" on visualpedia_components
  for insert to authenticated with check (
    exists (
      select 1 from visualpedia_topics t
      where t.id = topic_id and t.created_by = (select auth.uid())
    )
  );

create policy "visualpedia_relationships_insert_own_topic" on visualpedia_relationships
  for insert to authenticated with check (
    exists (
      select 1 from visualpedia_topics t
      where t.id = topic_id and t.created_by = (select auth.uid())
    )
  );

create policy "visualpedia_generations_insert_own" on visualpedia_generations
  for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "visualpedia_generations_update_own" on visualpedia_generations
  for update to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "visualpedia_topic_images_insert_authenticated" on storage.objects
  for insert to authenticated with check (bucket_id = 'visualpedia-topic-images');
create policy "visualpedia_topic_images_update_authenticated" on storage.objects
  for update to authenticated using (bucket_id = 'visualpedia-topic-images');
