import { throwCleanApiError } from '@/lib/ai/errors';
import { TEXT_MODEL } from '@/lib/ai/llm';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateChatReply(system: string, history: ChatTurn[]): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY is required');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      max_tokens: 1024,
      system,
      messages: history,
    }),
  });

  if (!response.ok) {
    await throwCleanApiError('chat', 'Anthropic', response);
  }

  const data = await response.json();
  const textBlock = (data.content as { type: string; text?: string }[])?.find(
    (block) => block.type === 'text'
  );
  return textBlock?.text ?? '';
}
