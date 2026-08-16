import { throwCleanApiError } from '@/lib/ai/errors';
import { getLlmProvider } from '@/state/settings-store';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateChatReply(system: string, history: ChatTurn[]): Promise<string> {
  const provider = getLlmProvider();
  if (provider === 'anthropic') return replyWithAnthropic(system, history);
  if (provider === 'gemini') return replyWithGemini(system, history);
  return replyWithOpenAI(system, history);
}

async function replyWithOpenAI(system: string, history: ChatTurn[]): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY is required when LLM_PROVIDER=openai');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.EXPO_PUBLIC_OPENAI_TEXT_MODEL ?? 'gpt-4o-mini',
      messages: [{ role: 'system', content: system }, ...history],
    }),
  });

  if (!response.ok) {
    await throwCleanApiError('chat', 'OpenAI', response);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function replyWithAnthropic(system: string, history: ChatTurn[]): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.EXPO_PUBLIC_ANTHROPIC_TEXT_MODEL ?? 'claude-sonnet-5',
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

async function replyWithGemini(system: string, history: ChatTurn[]): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is required when LLM_PROVIDER=gemini');

  const model = process.env.EXPO_PUBLIC_GEMINI_TEXT_MODEL ?? 'gemini-flash-latest';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: history.map((turn) => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        })),
        systemInstruction: { parts: [{ text: system }] },
      }),
    }
  );

  if (!response.ok) {
    await throwCleanApiError('chat', 'Gemini', response);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts as { text?: string }[] | undefined;
  return parts?.map((part) => part.text ?? '').join('') ?? '';
}
