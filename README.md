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
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System context, generation-pipeline sequence, ER diagram, screen-flow graph, RLS model, error/retry flow — all with Mermaid diagrams |
| [`AGENTS.md`](AGENTS.md) | The no-backend trade-off and the constraints it imposes |
| [`DESIGN.md`](DESIGN.md) | Design tokens (color, type, spacing) and their source template |

## How it works

1. **Search** — type a query, or tap **Scan an object with your camera** to open the camera
   screen (`src/app/(app)/camera.tsx`, `expo-camera`), photograph something, and let Claude's
   vision model name it (`src/lib/ai/identify.ts` → `src/lib/ai/vision.ts`); that name is then
   fed into the same search flow. Existing topics are matched by Postgres full-text search
   over a generated `tsvector` of title + description (`src/services/search.ts`).
2. **Generate** — no match found (or the user asks for a fresh take)? The generation
   pipeline (`src/services/generation.ts`, `runGeneration()`) runs entirely on-device:
   - Calls Claude with a forced tool call (strict JSON schema) to produce structured
     knowledge: title, description, domain, overview, 5–10 real components with their
     relationships, materials (with spec + rationale), a chronological construction sequence,
     a science/engineering principle with formula, failure modes, sources, a simplified
     top-to-bottom "flow" chain, and 2–4 paragraphs of prose explaining how it all works
     together.
   - Persists the topic, its components, and their relationships straight to Postgres.
   - Builds a long, carefully engineered prompt (`src/lib/ai/image.ts`) from that
     structured knowledge and asks Gemini to generate a single infographic image: a large
     labeled 3D cutaway illustration plus a "Materials" and "Construction sequence" side
     panel, numbered callouts that map 1:1 onto the components list, museum/textbook visual
     style, plain white background.
   - Uploads the image to Supabase Storage and writes the public URL back onto the topic.
   - Runs one best-effort vision pass (`src/lib/ai/hotspots.ts`) asking Claude to locate
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
   `visualpedia_search_history`) and a static "Suggested topics" starter list.

There is no server-driven progress channel: `runGeneration` reports phase transitions
(`understanding → knowledge → components → image → finalizing → complete`) directly to a
callback, which `useGeneration` (`src/hooks/use-generation.ts`) mirrors into React state to
drive the progress UI. If a step fails with a transient error (429/5xx), the UI offers a
one-tap retry that resubmits the same request.

## Architecture

**There is no backend server.** Supabase is used purely as Postgres + Auth + Storage — no
Edge Functions. The Expo app calls the Anthropic and Google Gemini REST APIs directly from
the client via plain `fetch` (no Node SDKs, which assume a Node runtime the RN bundle doesn't
have) and writes results straight into Postgres/Storage under the signed-in user's own
RLS-scoped session.

This was a deliberate trade-off, not an oversight: Edge Functions kept hitting Supabase CLI
auth/IPv6 friction in this environment, and the call was made to accept API keys being
bundled into the client (`EXPO_PUBLIC_*` env vars — visible in the installed app binary) in
exchange for not fighting deployment further. **This should be revisited before any public
release** — anyone who decompiles the app gets your AI provider keys.

```
Search box ──► services/search.ts ──► Postgres (full-text tsvector)
                                              │
                                     no match / new request
                                              ▼
                                services/generation.ts (runGeneration)
                                   │                        │
                             lib/ai/llm.ts            lib/ai/image.ts
                             (Claude, structured      (Gemini, infographic
                              knowledge via tool)      prompt)
                                   │                        │
                                   ▼                        ▼
                          Postgres (topics,         Supabase Storage
                          components,               (topic-images bucket)
                          relationships)
```

A full set of diagrams (pipeline sequence, entity-relationship, screen flow) lives in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Because generation is a single in-process client call rather than an async job watched via
Realtime, `useGeneration` just awaits `runGeneration` and mirrors its phase callback into
state — no `postgres_changes` subscription is needed (the client *is* the process). The init
DB migration still enables Realtime on `visualpedia_generations`, but nothing subscribes to
it.

### Shared Supabase project

This Supabase project is shared across multiple apps. Every table, type, function, index,
policy, and storage bucket this app owns is prefixed `visualpedia_` to avoid collisions.
Always reference names through `src/lib/tables.ts` (`Tables`, `Buckets`) rather than
hardcoding table-name strings anywhere else in the app.

### AI models

One provider per job, fixed at build time — no runtime switching, no per-model overrides:

| Concern | Model | Where |
| ------- | ----- | ----- |
| Structured knowledge (text) | Claude (`claude-sonnet-5`) | `src/lib/ai/llm.ts` — `TEXT_MODEL`, forced tool call against `KNOWLEDGE_JSON_SCHEMA` |
| Chat replies | Claude (`claude-sonnet-5`) | `src/lib/ai/chat.ts` |
| Vision — camera "scan an object" & component hotspots | Claude (`claude-sonnet-5`) | `src/lib/ai/vision.ts` — inline base64 image |
| Infographic image | Gemini (`gemini-3-pro-image-preview`, "Nano Banana Pro") | `src/lib/ai/image.ts` — `IMAGE_MODEL` |

- The model names are exported constants (`TEXT_MODEL`, `IMAGE_MODEL`). The Settings screen
  shows those same constants, so a displayed model name can never drift from what's actually
  requested.
- Every Claude knowledge response is validated against a shared `zod` schema
  (`GeneratedKnowledgeSchema` in `src/lib/ai/llm.ts`) before it's allowed to reach the DB —
  a malformed/hallucinated JSON response fails loudly with a clear error instead of writing
  bad data or crashing downstream, since there's no server-side review step.
- Gemini's image endpoint has no alpha-channel mechanism, and asking it in plain text for a
  "transparent background" backfires (it draws a literal checkerboard icon rather than
  omitting pixels), so the infographic prompt always asks for a plain white background.
- **Search is keyword-only.** Semantic/vector search, near-duplicate detection, and the
  embedding-driven "Suggested topics" section were removed when the text pipeline moved to
  Claude (which has no embeddings API). `20260909000000_drop_embeddings.sql` drops the
  pgvector column and its RPCs. Embeddings will return later via a different mechanism.

### The infographic image prompt

`src/lib/ai/image.ts` builds one large, structured prompt per generation from the topic's
own structured knowledge — role, style, two-zone layout (a dominant cutaway + a narrow
"Materials"/"Construction sequence" side column), camera angle, material-realism guidance
derived from the topic's actual materials list, numbered-callout format with strict
"numbering integrity" rules (every component labeled exactly once, no invented labels), and
an explicit list of what must *not* appear on the image (title, key-features panel, formulas,
etc. — all of that already has its own tab in the app UI). The page background is always a
plain white fill.

### Data model

DB rows are `snake_case`; application types (`src/types/knowledge.ts`) are `camelCase`.
Conversion always goes through `src/lib/db-mappers.ts` — never hand-rolled per component.

| Table                          | Purpose |
| ------------------------------- | ------- |
| `visualpedia_topics`            | Generated topics: title, description, domain, `structured_knowledge` (jsonb: overview, materials, construction, science, failure modes, sources, related slugs, flow, howItWorks prose), image URL/storage path, generated `tsvector` for full-text search. |
| `visualpedia_components`        | A topic's real physical parts: name, description, `does` (what it does), `why` (why it exists), materials, `metadata` jsonb (normalized bounding box for image hotspots), sort order. |
| `visualpedia_relationships`     | Typed edges between components: `partOf`, `connectedTo`, `supports`, `transfersLoadTo`, `madeOf`, `powers`, `causes`. |
| `visualpedia_generations`       | One row per generation attempt: query, status (`pending → understanding → knowledge → components → image → finalizing → complete`/`failed`), error message, resulting topic. |
| `visualpedia_bookmarks`         | Per-user saved topics. |
| `visualpedia_search_history`    | Per-user recent searches, with the topic they resolved to (if any). |
| `visualpedia_chat_messages`     | Per-user chat transcript per topic, optionally scoped to a specific component (`component_context_id`). |

Full-text search runs against a generated `tsvector` column (`search_text`) combining title +
description, with a GIN index. `pg_trgm` is enabled. (`pgvector` was used for semantic search
and dedup; `20260909000000_drop_embeddings.sql` removed that surface.)

### Row-level security

- The knowledge graph (topics/components/relationships) is readable by any authenticated
  user.
- Because generation runs client-side (see Architecture above) rather than through a
  service-role Edge Function, authenticated users also have direct `INSERT`/`UPDATE` access
  — scoped by ownership, not just role membership. In particular, component and relationship
  `INSERT`s require the target `topic_id` to belong to a topic the caller created
  (`exists (select 1 from visualpedia_topics t where t.id = topic_id and t.created_by =
  auth.uid())`), which closes an IDOR that a bare `to authenticated` policy would leave open
  (any signed-in user attaching rows to someone else's topic).
- Bookmarks, search history, and chat messages are strictly own-row-only (`auth.uid() =
  user_id`).
- The `visualpedia-topic-images` Storage bucket is public-read, authenticated-insert/update.

Migrations in `supabase/migrations/` (apply in order):

| Migration | What it does |
| --------- | ------------ |
| `20260811035143_init_schema.sql` | Schema + initial RLS + storage bucket + full-text search |
| `20260811050231_component_narrative_fields.sql` | Split `purpose` into `does` / `why` |
| `20260811055049_client_write_access.sql` | Client-write-access RLS policies (described above) |
| `20260827000000_related_topics_rpc.sql` | `visualpedia_related_topics` RPC (later dropped) |
| `20260828000000_embedding_provider.sql` | `embedding_provider` column (later dropped) + the `visualpedia_components` `UPDATE` policy the hotspot pass needs |
| `20260909000000_drop_embeddings.sql` | Drops the `embedding` / `embedding_provider` columns and the `visualpedia_match_topics` / `visualpedia_related_topics` RPCs |

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
│       ├── index.tsx       home: search, camera scan, suggested topics, recent topics, generation UI
│       ├── camera.tsx      full-screen modal: expo-camera capture → identify → hand back to home
│       ├── topic/[id].tsx  topic detail: image + hotspots, 5 tabs, chat, drill-down
│       ├── bookmarks.tsx   saved topics
│       └── settings.tsx    theme, AI-model info (read-only), sign out
├── components/              chat-sheet, component-detail-sheet, flow-chain, zoomable-image,
│                             generation-progress, themed-text/-view, tabs, toast, etc.
├── constants/theme.ts       spacing/radii/colors — dynamic light/dark/system theming
├── hooks/                    use-generation, use-theme, use-toast
├── lib/
│   ├── ai/                  llm.ts, image.ts, chat.ts, vision.ts, hotspots.ts, identify.ts,
│   │                         errors.ts — all provider fetch calls + ApiError/retryable
│   ├── db-mappers.ts         snake_case ⇄ camelCase conversion
│   ├── slug.ts                unique slug generation for new topics
│   ├── supabase.ts            Supabase client, large-session-safe SecureStore/AsyncStorage
│   ├── tables.ts               Tables/Buckets name constants
│   └── logger.ts                structured, level-gated, secret-redacting logger
├── services/                  generation.ts (the pipeline), search.ts, topics.ts,
│                               bookmarks.ts, history.ts, chat.ts — one file per DB concern
├── state/                     auth-context (Supabase session), theme-store, pending-scan
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
- **expo-camera** (camera-scan capture), **expo-image-picker** (the "choose a photo instead"
  fallback when the camera can't start), **expo-image-manipulator** (downscale before the
  vision call).
- TypeScript throughout, path-aliased via `@/*` → `src/*` (`tsconfig.json`).

> **Expo has changed a lot.** Before writing Expo-specific code, check the exact versioned
> docs at https://docs.expo.dev/versions/v57.0.0/ rather than relying on training-data
> knowledge of older Expo APIs.

## Getting started

### Prerequisites

- Node.js and npm
- A Supabase project (Postgres + Auth + Storage) — with its `visualpedia_*`-prefixed schema
  applied (see Database setup). The `pg_trgm` extension is enabled by the init migration.
- An **Anthropic API key** (text, chat, vision) and a **Google Gemini API key** (images).

### Environment variables

Create a `.env` file in the project root (never committed — see `.gitignore` and
[`.env.example`](.env.example)):

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=<anon/publishable key>

# AI keys -- must be EXPO_PUBLIC_-prefixed or Expo won't inline them into the bundle.
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...   # structured knowledge, chat, vision
EXPO_PUBLIC_GEMINI_API_KEY=...             # infographic image generation

# Server-only (not EXPO_PUBLIC_) -- used by the Supabase CLI / dashboard, never by the app
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Both AI keys are bundled into the client build (see Architecture — this is a known,
deliberate trade-off, not a mistake). Do not treat this app's build artifacts as safe to
distribute publicly without revisiting that decision first.

### Database setup

Apply the migrations in `supabase/migrations/` in order (via the Supabase CLI or dashboard
SQL editor) against your project. They create the `visualpedia_*` schema, RLS policies, the
`visualpedia-topic-images` storage bucket, and the full-text search index.

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
- **`visualpedia_generations` Realtime is enabled but unused** — nothing subscribes to it
  since generation runs synchronously in the client process; it's there for a possible future
  cross-device/background-generation flow.
- **No semantic search.** Search is Postgres full-text only; there is no near-duplicate
  detection (the same subject can be generated twice) and no personalized "Suggested topics".
  Reintroducing embeddings via a non-OpenAI mechanism is a planned follow-up.
- **Image hotspots depend on a best-effort vision pass.** After the infographic is generated,
  `src/lib/ai/hotspots.ts` asks Claude to locate each component on its own output and writes
  the boxes to `components.metadata.bbox`; a miss just means fewer tappable regions. Needs the
  `20260828` migration (adds the `components` `UPDATE` policy) for the writes to persist under
  RLS.
