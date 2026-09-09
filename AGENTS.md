# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Sketch Studios

AI-powered visual knowledge engine (Expo + Supabase, mobile-first via Expo Go). Search any
object/system/concept, get a generated technical cutaway illustration plus structured,
explorable knowledge (components, relationships, materials, construction steps, contextual
AI chat, recursive drill-down into sub-components).

- Routes live under `src/app` (expo-router auto-detects this instead of `app/`).
- **No backend at all** -- Supabase is Postgres + Auth + Storage only (no Edge Functions). The
  app calls Anthropic (text / chat / vision) and Google Gemini (images) directly from the
  client (`src/lib/ai/{llm,image,chat,vision}.ts`, plain `fetch`, no Node SDKs) and writes
  results straight to Postgres/Storage under the signed-in user's own RLS-scoped session. This
  was a deliberate trade-off: the alternative (Edge Functions) kept hitting Supabase CLI
  auth/IPv6 friction in this environment, and the user chose to accept API keys being bundled
  into the client (`EXPO_PUBLIC_*` env vars, visible in the installed app) rather than keep
  fighting deployment. Revisit before any public release. `src/services/generation.ts`'s
  `runGeneration()` drives the whole search->knowledge->image pipeline in-process;
  `src/hooks/use-generation.ts` just mirrors its phase callback into state (no Realtime
  subscription needed -- the client *is* the process).
- This Supabase project is shared across apps -- every table/type/function/index/policy/bucket
  is prefixed `visualpedia_`. Always go through `src/lib/tables.ts` (`Tables`, `Buckets`)
  rather than hardcoding table name strings.
- RLS write policies use the ownership-check pattern (e.g. components/relationships INSERT
  requires the target `topic_id` to belong to a topic the caller created), not bare
  `to authenticated` -- see `supabase/migrations/20260811055049_client_write_access.sql`.
- **One provider per job, fixed at build time.** Text/knowledge and chat run on Claude
  (`src/lib/ai/llm.ts`, `chat.ts` -- `TEXT_MODEL = 'claude-sonnet-5'`); the infographic image
  runs on Gemini (`src/lib/ai/image.ts` -- `IMAGE_MODEL = 'gemini-3-pro-image-preview'`,
  "Nano Banana Pro"). No provider switch, no per-model env override, no Settings toggle -- the
  model constants are the single source of truth and the Settings screen just displays them.
- All image->text (vision) calls go through `src/lib/ai/vision.ts` (`askVisionJson`), which
  sends an inline base64 image to Claude. Two callers: `hotspots.ts` (locate components on a
  generated cutaway) and `identify.ts` (the camera "scan an object" feature -- the `camera`
  route (`src/app/(app)/camera.tsx`, `expo-camera`'s `CameraView`, with an `expo-image-picker`
  library fallback since Expo Go's QR scanner tends to hold the back camera) shoots a photo,
  downscales it via `expo-image-manipulator`, `identifyImageSubject` names the subject, and the
  resulting term is handed back to Home via `src/state/pending-scan.ts` -- Home reads it on
  focus and runs it through the normal search/`runGeneration` pipeline).
- **Search is keyword-only** (`src/services/search.ts` -- Postgres full-text against the
  generated `search_text` tsvector). Semantic/vector search, near-duplicate detection, and the
  "Suggested topics" section were removed with the move off OpenAI embeddings (Claude has no
  embeddings API); `supabase/migrations/20260909000000_drop_embeddings.sql` drops the pgvector
  column and RPCs. Embeddings will return later via a different mechanism.
- DB rows are snake_case; app types in `src/types/knowledge.ts` are camelCase. Convert with
  `src/lib/db-mappers.ts`, don't hand-roll mapping in components.
- See `/Users/bernard/.claude/plans/refactored-popping-perlis.md` for the original architecture
  plan and milestone breakdown.
