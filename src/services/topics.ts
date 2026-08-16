import { mapComponent, mapRelationship, mapTopic, Row } from '@/lib/db-mappers';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/tables';
import { ComponentRelationship, Topic, TopicComponent } from '@/types/knowledge';

export interface TopicDetail {
  topic: Topic;
  components: TopicComponent[];
  relationships: ComponentRelationship[];
}

export async function getTopicById(id: string): Promise<TopicDetail | null> {
  const [{ data: topicRow, error: topicError }, { data: componentRows, error: componentsError }, { data: relationshipRows, error: relationshipsError }] =
    await Promise.all([
      supabase.from(Tables.topics).select('*').eq('id', id).maybeSingle(),
      supabase.from(Tables.components).select('*').eq('topic_id', id).order('sort_order'),
      supabase.from(Tables.relationships).select('*').eq('topic_id', id),
    ]);

  if (topicError) throw topicError;
  if (componentsError) throw componentsError;
  if (relationshipsError) throw relationshipsError;
  if (!topicRow) return null;

  return {
    topic: mapTopic(topicRow as Row.Topic),
    components: (componentRows ?? []).map((row) => mapComponent(row as Row.Component)),
    relationships: (relationshipRows ?? []).map((row) => mapRelationship(row as Row.Relationship)),
  };
}

export async function getTopicBySlug(slug: string): Promise<Topic | null> {
  const { data, error } = await supabase
    .from(Tables.topics)
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTopic(data as Row.Topic) : null;
}
