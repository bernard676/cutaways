# Sketch Studios

Sketch Studios is an AI-powered visual knowledge engine, built with Expo/React Native. Search
for any physical object, structure, machine, biological system, or technical concept, and
the app generates a museum-quality, labeled 3D cutaway infographic plus structured,
explorable engineering knowledge — components, relationships, materials, construction
sequence, failure modes, sources, and a contextual AI chat — with recursive drill-down into
any component's own sub-system.

Mobile-first.

## Documentation

| Doc | What's in it |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System context, generation-pipeline sequence, ER diagram, screen-flow graph, provider matrix, RLS model, error/retry flow — all with Mermaid diagrams |
| [`docs/how-to-add-ai-provider.md`](docs/how-to-add-ai-provider.md) | Step-by-step: wire a new LLM/chat/embeddings provider into `src/lib/ai/*` |
| [`AGENTS.md`](AGENTS.md) | The no-backend trade-off and the constraints it imposes |
| [`DESIGN.md`](DESIGN.md) | Design tokens (color, type, spacing) and their source template |

## How it works

1. **Search** — type a query. Existing topics are matched first via a hybrid of Postgres
   full-text search and pgvector semantic similarity (`src/services/search.ts`).
2. **Generate** — no match found (or the user asks for a fresh take)? The generation
   pipeline (`src/services/generation.ts`, `runGeneration()`) runs entirely on-device:
   - Embeds the query and checks for a near-duplicate existing topic (cosine similarity
     ≥ 0.92) to avoid regenerating the same subject twice.
   - Calls an LLM with a strict JSON schema to produce structured knowledge: title,
     description, domain, overview, 5–10 real components with their relationships,
     materials (with spec + rationale), a chronological construction sequence, a
     science/engineering principle with formula, failure modes, sources, a simplified
     top-to-bottom "flow" chain, and 2–4 paragraphs of prose explaining how it all works
     together.
   - Persists the topic, its components, and their relationships straight to Postgres.
   - Builds a long, carefully engineered prompt (`src/lib/ai/image.ts`) from that
     structured knowledge and generates a single infographic image: a large labeled 3D
     cutaway illustration plus a "Materials" and "Construction sequence" side panel,
     numbered callouts that map 1:1 onto the components list, museum/textbook visual
     style, transparent background where the provider supports it.
   - Uploads the image to Supabase Storage and writes the public URL back onto the topic.
   - Runs one best-effort vision pass (`src/lib/ai/hotspots.ts`) asking the model to locate
     each component on the cutaway it just produced, and stores the normalized boxes on
     `components.metadata.bbox` for the topic screen's tappable overlay. A failure here is a
     silent no-op.
3. **Explore** — the topic screen renders the generated image with interactive
   component hotspots, and five tabs: Components, How it works, Build (construction),
   Engineering (science/failure modes), Sources.
4. **Drill down** — tapping a component can generate a *new* infographic scoped to just
   that component, using the parent topic's description as context so terminology, scale,
   and domain stay consistent (`ComponentDetailSheet`'s "Generate new infographic" /
   `parentContext` in `runGeneration`).
5. **Ask** — a contextual AI chat sheet lets the user ask questions about the topic as a
   whole, or about a specific selected component, with history persisted per-user. The chat
   prompt is scoped hard to the current topic; off-topic questions get a canned redirect.
6. **Come back** — the Home screen shows the user's recent topics (distinct-by-topic, from
   `visualpedia_search_history`) and "Suggested topics" (`visualpedia_related_topics` RPC:
   nearest neighbours to the averaged embedding of the last 10 topics they opened, falling
   back to a static starter list before any history exists).

There is no server-driven progress channel: `runGeneration` reports phase transitions
(`understanding → knowledge → components → image → finalizing → complete`) directly to a
callback, which `useGeneration` (`src/hooks/use-generation.ts`) mirrors into React state to
drive the progress UI. If a step fails with a transient error (429/5xx), the UI offers a
one-tap retry that resubmits against a smaller/less-contested fallback model rather than
just hammering the same failing model again.

## Architecture

**There is no backend server.** Supabase is used purely as Postgres + Auth + Storage — no
Edge Functions. The Expo app calls the OpenAI, Anthropic, and Google Gemini REST APIs
directly from the client via plain `fetch` (no Node SDKs, which assume a Node runtime the
RN bundle doesn't have) and writes results straight into Postgres/Storage under the
signed-in user's own RLS-scoped session.

This was a deliberate trade-off, not an oversight: Edge Functions kept hitting Supabase CLI
auth/IPv6 friction in this environment, and the call was made to accept API keys being
bundled into the client (`EXPO_PUBLIC_*` env vars — visible in the installed app binary) in
exchange for not fighting deployment further. **This should be revisited before any public
release** — anyone who decompiles the app gets your AI provider keys.

```
Search box ──► services/search.ts ──► Postgres (full-text + pgvector RPC)
                                              │
                                     no match / new request
                                              ▼
                                services/generation.ts (runGeneration)
                                   │        │            │
                          lib/ai/llm.ts  lib/ai/embeddings.ts  lib/ai/image.ts
                          (OpenAI/         (Gemini native, else  (OpenAI/Gemini,
                           Anthropic/       OpenAI; dedup +       infographic prompt)
                           Gemini)          search)
                                   │                              │
                                   ▼                              ▼
                          Postgres (topics,              Supabase Storage
                          components,                    (topic-images bucket)
                          relationships)
```

A full set of diagrams (pipeline sequence, entity-relationship, screen flow, provider
matrix) lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Because generation is a single in-process client call rather than an async job watched via
Realtime, `useGeneration` just awaits `runGeneration` and mirrors its phase callback into
state — no `postgres_changes` subscription is needed for the happy path (the client *is*
the process). The DB migration still enables Realtime on `visualpedia_generations` for
future use / cross-device observability, but nothing currently subscribes to it.

### Shared Supabase project

This Supabase project is shared across multiple apps. Every table, type, function, index,
policy, and storage bucket this app owns is prefixed `visualpedia_` to avoid collisions.
Always reference names through `src/lib/tables.ts` (`Tables`, `Buckets`, `Rpc`) rather than
hardcoding table-name strings anywhere else in the app.

### Multi-provider AI, swappable per install

Both the text/knowledge model and the image model default from `EXPO_PUBLIC_*` env vars at
build time, and either can be switched at runtime from the Settings screen (persisted to
`AsyncStorage`, restored on next launch; a provider with no bundled API key is shown
locked). The Home screen's `ModelBadge` and the Settings rows show the exact model string,
never a hand-maintained label.

| Concern            | Providers                    | Selected via                      |
| ------------------ | ----------------------------- | ---------------------------------- |
| Structured knowledge (text) | OpenAI, Anthropic, Google Gemini | `EXPO_PUBLIC_LLM_PROVIDER` + Settings |
| Infographic image   | OpenAI, Google Gemini          | `EXPO_PUBLIC_IMAGE_PROVIDER` + Settings |
| Chat replies        | OpenAI, Anthropic, Google Gemini | follows the LLM provider above |
| Component hotspots (vision) | OpenAI, Anthropic, Google Gemini | follows the LLM provider above |
| Embeddings (search / dedup / suggestions) | Google Gemini (native) or OpenAI | follows the LLM provider (see below) |

- **Embeddings follow the LLM provider, with OpenAI as the floor** (`src/lib/ai/embeddings.ts`,
  `resolveEmbeddingProvider`). Gemini uses its own `gemini-embedding-001`, truncated to 1536
  dims via `outputDimensionality` (Matryoshka) so it fits the same fixed
  `visualpedia_topics.embedding vector(1536)` column that `text-embedding-3-small` targets.
  Anthropic has no embeddings API, so it (and OpenAI) use OpenAI's `text-embedding-3-small`.
  Two providers' vectors are not mutually comparable, so mixing providers across a topic
  corpus degrades similarity — the column just stays *usable* whichever provider wrote a row.
  Duplicate-check in `runGeneration`, semantic search in `searchTopics`, and the
  `visualpedia_related_topics` suggestions RPC all treat a missing or failing embeddings key
  as non-fatal: they log a warning and fall back (skip dedup / keyword-only search / static
  suggestion list) rather than blocking someone whose selected provider has no working key.
- Each provider's model name is resolved **once at module load** into an exported constant
  (`OPENAI_TEXT_MODEL`, `ANTHROPIC_TEXT_MODEL`, `GEMINI_TEXT_MODEL`, `OPENAI_IMAGE_MODEL`,
  `GEMINI_IMAGE_MODEL`), so the Settings screen can display the *exact* model actually being
  requested and never drift into a hand-maintained label that lies.
- Every provider validates the LLM response against a shared `zod` schema
  (`GeneratedKnowledgeSchema` in `src/lib/ai/llm.ts`) before it's allowed to reach the DB —
  a malformed/hallucinated JSON response fails loudly with a clear error instead of writing
  bad data or crashing downstream, since there's no server-side review step now that
  generation runs client-side.
- On a transient failure (429 rate-limit or 5xx), `getFallbackTextModel` /
  `getFallbackImageModel` name a smaller/less-contested model to retry against, sourced from
  env-overridable rolling `-latest`-style aliases rather than pinned dated snapshots (pinned
  snapshots get silently sunset for new users over time).
- Gemini's JSON schema dialect (OpenAPI 3.0 subset, uppercase `type` enum, no
  `additionalProperties`) is converted on the fly from the single shared JSON Schema
  (`toGeminiSchema` in `llm.ts`) so the three providers can't drift out of sync with each
  other.

### The infographic image prompt

`src/lib/ai/image.ts` builds one large, structured prompt per generation from the topic's
own structured knowledge — role, style, two-zone layout (a dominant cutaway + a narrow
"Materials"/"Construction sequence" side column), camera angle, material-realism guidance
derived from the topic's actual materials list, numbered-callout format with strict
"numbering integrity" rules (every component labeled exactly once, no invented labels), and
an explicit list of what must *not* appear on the image (title, key-features panel, formulas,
etc. — all of that already has its own tab in the app UI). Only OpenAI's `gpt-image-1` has a
true alpha-channel transparency mechanism; when Gemini is the image provider the prompt asks
for a plain white background instead, since asking Gemini in plain text for "transparent"
backfires (it draws a literal checkerboard icon rather than actually omitting pixels).

### Data model

DB rows are `snake_case`; application types (`src/types/knowledge.ts`) are `camelCase`.
Conversion always goes through `src/lib/db-mappers.ts` — never hand-rolled per component.

| Table                          | Purpose |
| ------------------------------- | ------- |
| `visualpedia_topics`            | Generated topics: title, description, domain, `structured_knowledge` (jsonb: overview, materials, construction, science, failure modes, sources, related slugs, flow, howItWorks prose), image URL/storage path, `embedding vector(1536)`, generated `tsvector` for full-text search. |
| `visualpedia_components`        | A topic's real physical parts: name, description, `does` (what it does), `why` (why it exists), materials, `metadata` jsonb (normalized bounding box for image hotspots), sort order. |
| `visualpedia_relationships`     | Typed edges between components: `partOf`, `connectedTo`, `supports`, `transfersLoadTo`, `madeOf`, `powers`, `causes`. |
| `visualpedia_generations`       | One row per generation attempt: query, status (`pending → understanding → knowledge → components → image → finalizing → complete`/`failed`), error message, resulting topic. |
| `visualpedia_bookmarks`         | Per-user saved topics. |
| `visualpedia_search_history`    | Per-user recent searches, with the topic they resolved to (if any). |
| `visualpedia_chat_messages`     | Per-user chat transcript per topic, optionally scoped to a specific component (`component_context_id`). |

Postgres extensions in use: `vector` (pgvector, HNSW cosine-similarity index on
`topics.embedding`) and `pg_trgm`. Full-text search runs against a generated `tsvector`
column (`search_text`) combining title + description. `visualpedia_match_topics` is the RPC
used for both semantic search and duplicate-topic detection.

### Row-level security

- The knowledge graph (topics/components/relationships) is readable by any authenticated
  user.
- Because generation now runs client-side (see Architecture above) rather than through a
  service-role Edge Function, authenticated users also have direct `INSERT`/`UPDATE` access
  — scoped by ownership, not just role membership. In particular, component and relationship
  `INSERT`s require the target `topic_id` to belong to a topic the caller created
  (`exists (select 1 from visualpedia_topics t where t.id = topic_id and t.created_by =
  auth.uid())`), which closes an IDOR that a bare `to authenticated` policy would leave open
  (any signed-in user attaching rows to someone else's topic).
- Bookmarks, search history, and chat messages are strictly own-row-only (`auth.uid() =
  user_id`).
- The `visualpedia-topic-images` Storage bucket is public-read, authenticated-insert/update.

See `supabase/migrations/` — `20260811035143_init_schema.sql` (schema + initial RLS),
`20260811050231_component_narrative_fields.sql` (split `purpose` into `does`/`why`),
`20260811055049_client_write_access.sql` (the client-write-access policies described above),
and `20260827000000_related_topics_rpc.sql` (`visualpedia_related_topics`, backing the Home
screen's "Suggested topics" — averages the embeddings of the user's recently-viewed topics
in Postgres and returns the nearest neighbours).

> Note: the init migration's comments still say "all writes go through Edge Functions using
> the service-role key" and it `alter publication supabase_realtime add table
> visualpedia_generations` — both predate the move to client-side generation. The later
> `client_write_access` migration supersedes the RLS comment, and nothing subscribes to the
> Realtime publication. Left as-is because rewriting an applied migration is worse than a
> stale comment; the current behaviour is what this README and `AGENTS.md` describe.

## App structure

Routes live under `src/app` (this project points Expo Router at `src/app` instead of the
default `app/`).

```
src/
├── app/
│   ├── (auth)/            sign-in, sign-up — unauthenticated stack
│   └── (app)/              authenticated stack, redirects to sign-in if no session
│       ├── index.tsx       home: search, suggested topics, recent topics, generation UI
│       ├── topic/[id].tsx  topic detail: image + hotspots, 5 tabs, chat, drill-down
│       ├── bookmarks.tsx   saved topics
│       └── settings.tsx    theme, LLM/image provider selection, sign out
├── components/              chat-sheet, component-detail-sheet, flow-chain, zoomable-image,
│                             generation-progress, themed-text/-view, tabs, toast, etc.
├── constants/theme.ts       spacing/radii/colors — dynamic light/dark/system theming
├── hooks/                    use-generation, use-settings, use-theme, use-toast
├── lib/
│   ├── ai/                  llm.ts, image.ts, chat.ts, embeddings.ts, hotspots.ts,
│   │                         errors.ts — all provider fetch calls + ApiError/retryable
│   ├── db-mappers.ts         snake_case ⇄ camelCase conversion
│   ├── slug.ts                unique slug generation for new topics
│   ├── supabase.ts            Supabase client, large-session-safe SecureStore/AsyncStorage
│   ├── tables.ts               Tables/Buckets/Rpc name constants
│   └── logger.ts                structured, level-gated, secret-redacting logger
├── services/                  generation.ts (the pipeline), search.ts, topics.ts,
│                               bookmarks.ts, history.ts, chat.ts — one file per DB concern
├── state/                     auth-context (Supabase session), settings-store (provider
│                               choice), theme-store
└── types/knowledge.ts          app-level camelCase types
```

### Auth & session storage

Supabase Auth (email/password). Sessions are persisted through a custom
`LargeSecureStore` (`src/lib/supabase.ts`): `expo-secure-store` rejects values over ~2KB but
a Supabase session can exceed that, so the session itself lives in `AsyncStorage` encrypted
with an AES-256-CTR key that SecureStore holds — Supabase's documented pattern for Expo.

### Theming

Light/dark/system theming (`src/constants/theme.ts`, `src/state/theme-store.ts`,
`useTheme`/`useThemePreference`), switchable from Settings, with fonts from
`@expo-google-fonts` — Space Grotesk (display/headings), Inter (body/UI), JetBrains Mono
(labels, breadcrumbs, specs, formulas). The `Fonts` map in `theme.ts` must stay in sync with
the family names registered in `src/app/_layout.tsx`'s `useFonts()` call, or RN silently
falls back to the system font.

## Tech stack

- **Expo SDK 54** / React Native 0.81 / React 19, file-based routing via `expo-router`,
  React Compiler + typed routes enabled (`app.json` experiments).
- **Supabase** (`@supabase/supabase-js`) — Postgres, Auth, Storage only.
- **TanStack Query** for server-state fetching/caching (recent topics, etc.).
- **Zod** for runtime validation of LLM responses.
- **React Native Reanimated / Gesture Handler / Bottom Sheet** for the component/chat
  sheets and swipe-to-dismiss interactions.
- **react-native-svg**, **expo-image** for the topic illustration + hotspots.
- TypeScript throughout, path-aliased via `@/*` → `src/*` (`tsconfig.json`).

> **Expo has changed a lot.** Before writing Expo-specific code, check the exact versioned
> docs at https://docs.expo.dev/versions/v57.0.0/ rather than relying on training-data
> knowledge of older Expo APIs.

## Getting started

### Prerequisites

- Node.js and npm
- A Supabase project (Postgres + Auth + Storage) — this app expects the `vector` and
  `pg_trgm` extensions to be enabled and its own `visualpedia_*`-prefixed schema applied.
- At least one AI provider API key: OpenAI (required either way, for embeddings/search) and
  optionally Anthropic and/or Google Gemini.

### Environment variables

Create a `.env` file in the project root (never committed — see `.gitignore`):

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=<anon/publishable key>

# Provider selection -- must be EXPO_PUBLIC_-prefixed or Expo won't inline it into the
# bundle, and settings-store.ts will silently fall back to its openai/openai defaults.
EXPO_PUBLIC_LLM_PROVIDER=openai      # openai | anthropic | gemini
EXPO_PUBLIC_IMAGE_PROVIDER=openai    # openai | gemini

# Provider keys (only the ones you select above are required at runtime, but
# EXPO_PUBLIC_OPENAI_API_KEY is effectively required regardless -- embeddings/search always
# use OpenAI)
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
EXPO_PUBLIC_GEMINI_API_KEY=...

# Optional model overrides (defaults live in src/lib/ai/llm.ts and image.ts)
# EXPO_PUBLIC_OPENAI_TEXT_MODEL=gpt-4o-mini
# EXPO_PUBLIC_ANTHROPIC_TEXT_MODEL=claude-sonnet-5
# EXPO_PUBLIC_GEMINI_TEXT_MODEL=gemini-flash-latest
# EXPO_PUBLIC_OPENAI_IMAGE_MODEL=gpt-image-1
# EXPO_PUBLIC_GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
# EXPO_PUBLIC_ANTHROPIC_TEXT_FALLBACK_MODEL=claude-haiku-4-5-20251001
# EXPO_PUBLIC_GEMINI_TEXT_FALLBACK_MODEL=gemini-flash-lite-latest
# EXPO_PUBLIC_GEMINI_IMAGE_FALLBACK_MODEL=gemini-2.5-flash-image
```

All AI provider keys are bundled into the client build (see Architecture — this is a known,
deliberate trade-off, not a mistake). Do not treat this app's build artifacts as safe to
distribute publicly without revisiting that decision first.

### Database setup

Apply the migrations in `supabase/migrations/` in order (via the Supabase CLI or dashboard
SQL editor) against your project. They create the `visualpedia_*` schema, RLS policies, the
`visualpedia-topic-images` storage bucket, and the `visualpedia_match_topics` search RPC.

### Install & run

```bash
npm install
npx expo start
```

Then open the app in:

- [Expo Go](https://expo.dev/go) (fastest way to develop against this project)
- an iOS Simulator / Android Emulator
- a [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- the web (`npm run web`) — `expo-router` web output is set to `single` in `app.json`

Other scripts: `npm run ios`, `npm run android`, `npm run lint` (`expo lint`),
`npm test` (Jest via the `jest-expo` preset — unit tests for the pure logic in `src/lib`,
see [`docs/ARCHITECTURE.md` → Testing](docs/ARCHITECTURE.md#testing)), and
`npm run reset-project` (Expo's stock template-reset script — not typically needed here
since `src/app` is already a real app, not starter boilerplate).

## Known limitations / open items

- **Client-bundled API keys.** See Architecture — revisit before any public release.
- **No server-side moderation/review** of AI-generated content before it's written to the
  shared knowledge graph, beyond schema validation.
- **`visualpedia_generations` Realtime is enabled but unused** — nothing currently
  subscribes to it since generation runs synchronously in the client process; it's there for
  a possible future cross-device/background-generation flow.
- **An Anthropic-only install has degraded search.** Anthropic has no embeddings API, so it
  falls back to OpenAI's `text-embedding-3-small`; with no OpenAI key either, search is
  keyword-only and there's no duplicate-topic detection or "Suggested topics".
- **Mixed-provider embedding corpus.** Switching the LLM provider after topics already exist
  leaves the table with vectors from two non-aligned embedding spaces. The duplicate-check is
  now scoped to same-provider rows (`embedding_provider` column + `match_provider` filter,
  `20260828` migration), but cross-provider *search* ranking is still weakened.
  `scripts/backfill-embeddings.js` re-embeds everything with the current provider.
- **Image hotspots depend on a best-effort vision pass.** After the infographic is generated,
  `src/lib/ai/hotspots.ts` asks the model to locate each component on its own output and
  writes the boxes to `components.metadata.bbox`; a miss just means fewer tappable regions.
  Needs the `20260828` migration (adds the `components` `UPDATE` policy) for the writes to
  persist under RLS.
