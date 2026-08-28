import { ChatTurn, generateChatReply } from '@/lib/ai/chat';
import { mapChatMessage, Row } from '@/lib/db-mappers';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/tables';
import { ChatMessage } from '@/types/knowledge';

const HISTORY_LIMIT = 12;
const REPLY_FAILURE_TEXT = "Sorry, I couldn't answer that just now. Please try again.";

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

  // The user turn is already persisted, so if the reply call fails we still write an
  // assistant row (with a canned apology) rather than leaving a dangling user message that
  // reloads with no answer next to it. The error is re-thrown so the caller's UI can react.
  let reply: string;
  try {
    reply = await generateChatReply(system, history);
  } catch (err) {
    logger.error('chat', 'Reply generation failed; persisting placeholder', err);
    await supabase.from(Tables.chatMessages).insert({
      topic_id: topicId,
      user_id: userId,
      role: 'assistant',
      content: REPLY_FAILURE_TEXT,
      component_context_id: componentId,
    });
    throw err;
  }

  await supabase.from(Tables.chatMessages).insert({
    topic_id: topicId,
    user_id: userId,
    role: 'assistant',
    content: reply,
    component_context_id: componentId,
  });

  return reply;
}

export const OFF_TOPIC_REPLY = 'Oops, I cannot answer that right now, but maybe try a new search.';

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
  lines.push(
    'Answer conversationally in a few sentences. Be concrete and specific to this topic.',
    'If the user sends a greeting, small talk, or a vague message with no real question (e.g. "hi", "hello", "hey"), ' +
      'reply with a single short, friendly sentence (no more than ~15 words) inviting them to ask something specific ' +
      'about this topic. Do not restate or summarize the overview, description, or components unless the user actually asks about them.',
    'Stay strictly scoped to this topic (and its components, materials, construction, and physics as shown above). ' +
      'Do not answer questions about unrelated topics, people, current events, or anything outside this context, ' +
      `even if the request itself is otherwise appropriate. In that case, reply with exactly this line and nothing else: "${OFF_TOPIC_REPLY}"`,
    'If a request is harmful, unsafe, or otherwise against your usage policies, decline briefly in your own words as you normally would, ' +
      'rather than using the off-topic line above.'
  );
  return lines.join('\n');
}
