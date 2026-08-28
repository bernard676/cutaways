# How to add an AI provider

This adds a new text/knowledge + chat provider (say, `mistral`) alongside the existing
OpenAI / Anthropic / Gemini. Image and embeddings follow the same shape in their own files.

## Prerequisites

- The provider has a REST endpoint reachable with a bearer token or `?key=` param (no Node
  SDK — the RN bundle has no Node runtime).
- It can return strict JSON matching a supplied schema, or has a tool-use mechanism you can
  force. If it can only "try" to return JSON, you'll need to be stricter in
  `parseGeneratedKnowledge`.
- An `EXPO_PUBLIC_MISTRAL_API_KEY` in `.env`.

## Steps

1. **Add the provider to the union types.** In
   [`src/state/settings-store.ts`](../src/state/settings-store.ts):

   ```ts
   export type LlmProvider = 'openai' | 'anthropic' | 'gemini' | 'mistral';
   ```

   and in `resolveLlmProvider()`:

   ```ts
   if (process.env.EXPO_PUBLIC_LLM_PROVIDER === 'mistral') return 'mistral';
   ```

   Also handle it in `loadSettings()`'s `storedLlm ===` guard.

2. **Add its model constant** in [`src/lib/ai/llm.ts`](../src/lib/ai/llm.ts):

   ```ts
   export const MISTRAL_TEXT_MODEL = process.env.EXPO_PUBLIC_MISTRAL_TEXT_MODEL ?? 'mistral-large-latest';
   ```

   And a fallback in `getFallbackTextModel()` if there's a smaller tier.

3. **Write the fetch function** in `llm.ts`, next to `generateWithOpenAI` /
   `generateWithAnthropic` / `generateWithGemini`:

   ```ts
   async function generateWithMistral(query: string, context?: string, modelOverride?: string) {
     const apiKey = process.env.EXPO_PUBLIC_MISTRAL_API_KEY;
     if (!apiKey) throw new Error('EXPO_PUBLIC_MISTRAL_API_KEY is required when LLM_PROVIDER=mistral');

     const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
       method: 'POST',
       headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
       body: JSON.stringify({
         model: modelOverride ?? MISTRAL_TEXT_MODEL,
         messages: [
           { role: 'system', content: SYSTEM_PROMPT },
           { role: 'user', content: buildUserPrompt(query, context) },
         ],
         response_format: { type: 'json_object' }, // or json_schema if supported
       }),
     });
     if (!response.ok) await throwCleanApiError('llm', 'Mistral', response);

     const data = await response.json();
     const content = data.choices?.[0]?.message?.content;
     if (!content) throw new Error('Mistral returned no content');
     return parseGeneratedKnowledge(JSON.parse(content), 'Mistral');
   }
   ```

   Key rules:
   - Route the non-2xx path through `throwCleanApiError('llm', 'Mistral', response)` — never
     throw the raw body.
   - End with `parseGeneratedKnowledge(raw, 'Mistral')` so the `zod` schema check runs.
   - If the provider's JSON-schema dialect differs from plain JSON Schema (Gemini's does),
     transform `KNOWLEDGE_JSON_SCHEMA` like `toGeminiSchema()` rather than maintaining a
     second copy.

4. **Dispatch to it** in `generateStructuredKnowledge()`:

   ```ts
   if (provider === 'mistral') return generateWithMistral(query, context, modelOverride);
   ```

5. **Do the same in [`src/lib/ai/chat.ts`](../src/lib/ai/chat.ts)** (add `replyWithMistral` +
   a branch in `generateChatReply()`) **and [`src/lib/ai/hotspots.ts`](../src/lib/ai/hotspots.ts)**
   (add `detectWithMistral` + a branch in `detectComponentHotspots()` — needs vision; if the
   provider has no vision model, route it to `detectWithOpenAI` as a fallback).

6. **Decide the embeddings story** in [`src/lib/ai/embeddings.ts`](../src/lib/ai/embeddings.ts).
   If Mistral has no embeddings API, `resolveEmbeddingProvider()` already returns `'openai'`
   for anything that isn't `'gemini'`, so it falls back automatically. If it does, add a
   `'mistral'` case to `EmbeddingProvider`, `EMBEDDING_PROVIDER_LABEL`,
   `resolveEmbeddingProvider()`, and an `embedWithMistral()` that returns a **1536-dim**
   vector (truncate if the model is larger — the column is `vector(1536)`).

7. **Surface it in Settings** — [`src/app/(app)/settings.tsx`](../src/app/(app)/settings.tsx)
   `LLM_INFO` needs a `mistral` entry (`{ label: 'Mistral', hint: MISTRAL_TEXT_MODEL, hasKey:
   !!process.env.EXPO_PUBLIC_MISTRAL_API_KEY }`) and `LLM_PROVIDERS` needs `'mistral'` added;
   [`src/components/model-badge.tsx`](../src/components/model-badge.tsx) `LABELS` needs one
   too. TypeScript flags every `Record<LlmProvider, ...>` map as incomplete until you do. The
   Settings row is selectable out of the box (`setLlmProvider` handles persistence).

8. **Update the backfill script** if you added embeddings —
   [`scripts/backfill-embeddings.js`](../scripts/backfill-embeddings.js) mirrors the provider
   choice independently (it's plain Node, no imports from `src/`).

## Verification

```bash
npx tsc --noEmit        # the Record<LlmProvider,...> maps must all be exhaustive
```

Set `EXPO_PUBLIC_LLM_PROVIDER=mistral` and `EXPO_PUBLIC_MISTRAL_API_KEY=...` in `.env`, then:

1. `npx expo start`, open the app — the `ModelBadge` on Home should read "Mistral" and
   Settings → Language model should show the exact model string.
2. Search something not in the DB → it should generate. Watch the Metro logs: a schema
   validation failure logs `Mistral response failed schema validation` with the raw payload.
3. Open the topic's chat sheet and send a message → reply should come back.

## Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Badge still says "OpenAI" | `EXPO_PUBLIC_` var not inlined (needs a full reload, not fast refresh) | Restart `expo start`, clear cache with `--clear` |
| `... returned an unexpected response` | Provider didn't return schema-valid JSON | Check the logged raw payload; tighten the prompt or use the provider's structured-output mode |
| `tsc` errors on `LLM_INFO` / `LABELS` | `Record<LlmProvider, ...>` maps not updated | Add the `mistral` key to both (step 7) |
| Chat works, generation doesn't (or vice versa) | Only one of `llm.ts` / `chat.ts` got the new branch | Both need the dispatch line |

## Related

- [ARCHITECTURE.md → Multi-provider AI](ARCHITECTURE.md#multi-provider-ai)
- [ARCHITECTURE.md → Error handling & retry](ARCHITECTURE.md#error-handling--retry)
