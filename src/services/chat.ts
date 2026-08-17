import { ChatTurn, generateChatReply } from '@/lib/ai/chat';
import { mapChatMessage, Row } from '@/lib/db-mappers';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/tables';
import { ChatMessage } from '@/types/knowledge';

const HISTORY_LIMIT = 12;

export async function listChatMessages(topicId: string): Promise<ChatMessage[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from(Tables.chatMessages)
    .select('*')
    .eq('topic_id', topicId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => mapChatMessage(row as Row.ChatMessage));
}

export async function sendChatMessage(
  topicId: string,
  message: string,
  componentId: string | null
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const [{ data: topic, error: topicError }, { data: component }, { data: historyRows }] =
    await Promise.all([
      supabase.from(Tables.topics).select('*').eq('id', topicId).maybeSingle(),
      componentId
        ? supabase.from(Tables.components).select('*').eq('id', componentId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from(Tables.chatMessages)
        .select('role, content')
        .eq('topic_id', topicId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT),
    ]);

  if (topicError || !topic) throw new Error('Topic not found');

  const system = buildSystemPrompt(topic as Row.Topic, component as Row.Component | null);
  const history: ChatTurn[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((row) => ({ role: row.role as 'user' | 'assistant', content: row.content as string }));
  history.push({ role: 'user', content: message });

  await supabase.from(Tables.chatMessages).insert({
    topic_id: topicId,
    user_id: userId,
    role: 'user',
    content: message,
    component_context_id: componentId,
  });

  const reply = await generateChatReply(system, history);

  await supabase.from(Tables.chatMessages).insert({
    topic_id: topicId,
    user_id: userId,
    role: 'assistant',
    content: reply,
    component_context_id: componentId,
  });

  return reply;
}

function buildSystemPrompt(topic: Row.Topic, component: Row.Component | null): string {
  const lines = [
    'You are a friendly, precise technical tutor inside Sketch Studios, a visual encyclopedia app.',
    `The user is currently viewing the topic "${topic.title}": ${topic.description}`,
    `Overview: ${topic.structured_knowledge?.overview ?? ''}`,
  ];
  if (component) {
    lines.push(
      `The user has selected the component "${component.name}" (${component.description}). ` +
        `When the user says "it" or "this", assume they mean "${component.name}" unless context says otherwise.`
    );
  }
  lines.push('Answer conversationally in a few sentences. Be concrete and specific to this topic.');
  return lines.join('\n');
}
