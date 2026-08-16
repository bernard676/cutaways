# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Visualpedia

AI-powered visual knowledge engine (Expo + Supabase, mobile-first via Expo Go). Search any
object/system/concept, get a generated technical cutaway illustration plus structured,
explorable knowledge (components, relationships, materials, construction steps, contextual
AI chat, recursive drill-down into sub-components).

- Routes live under `src/app` (expo-router auto-detects this instead of `app/`).
- **No backend at all** -- Supabase is Postgres + Auth + Storage only (no Edge Functions). The
  app calls OpenAI/Anthropic directly from the client (`src/lib/ai/{llm,image,embeddings,chat}.ts`,
  plain `fetch`, no Node SDKs) and writes results straight to Postgres/Storage under the
  signed-in user's own RLS-scoped session. This was a deliberate trade-off: the alternative
  (Edge Functions) kept hitting Supabase CLI auth/IPv6 friction in this environment, and the
  user chose to accept API keys being bundled into the client (`EXPO_PUBLIC_*` env vars, visible
  in the installed app) rather than keep fighting deployment. Revisit before any public release.
  `src/services/generation.ts`'s `runGeneration()` drives the whole search->knowledge->image
  pipeline in-process; `src/hooks/use-generation.ts` just mirrors its phase callback into state
  (no Realtime subscription needed anymore -- the client *is* the process).
- This Supabase project is shared across apps -- every table/type/function/index/policy/bucket
  is prefixed `visualpedia_`. Always go through `src/lib/tables.ts` (`Tables`, `Buckets`, `Rpc`)
  rather than hardcoding table name strings.
- RLS write policies use the ownership-check pattern (e.g. components/relationships INSERT
  requires the target `topic_id` to belong to a topic the caller created), not bare
  `to authenticated` -- see `supabase/migrations/20260811055049_client_write_access.sql`.
- LLM/image providers are swappable via env vars (`EXPO_PUBLIC_LLM_PROVIDER`,
  `EXPO_PUBLIC_IMAGE_PROVIDER` -- see `src/lib/ai/llm.ts` and `image.ts`). Currently OpenAI; the
  text/knowledge pipeline is expected to move to Anthropic (`EXPO_PUBLIC_LLM_PROVIDER=anthropic`)
  soon. Embeddings always use OpenAI regardless of provider (Anthropic has no embeddings API).
- DB rows are snake_case; app types in `src/types/knowledge.ts` are camelCase. Convert with
  `src/lib/db-mappers.ts`, don't hand-roll mapping in components.
- See `/Users/bernard/.claude/plans/refactored-popping-perlis.md` for the original architecture
  plan and milestone breakdown.
