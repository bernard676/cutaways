# Sketch Studios

AI-powered visual knowledge engine, built with Expo / React Native. Mobile-first.

Search any physical object, structure, machine, biological system, or technical concept, and
the app generates a museum-quality labeled 3D cutaway infographic plus structured, explorable
engineering knowledge — components, relationships, materials, construction sequence, failure
modes, sources, and a contextual AI chat — with recursive drill-down into any component's own
sub-system.

## Documentation

| Doc | What's in it |
| --- | --- |
| [`docs/SETUP.md`](docs/SETUP.md) | Prerequisites, env vars, database setup, install & run, scripts |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System context, generation pipeline, data model, migrations, screen flow, AI models, RLS, error/retry, project structure — with Mermaid diagrams |
| [`docs/planning.md`](docs/planning.md) | Business setup, one-off + infrastructure costs, direction, resources |
| [`AGENTS.md`](AGENTS.md) | The no-backend trade-off and the constraints it imposes |
| [`DESIGN.md`](DESIGN.md) | Design tokens (color, type, spacing) and their source template |

## How it works

1. **Search** — type a query, or tap **Scan an object with your camera** to photograph
   something and let Claude's vision model name it. Existing topics are matched by Postgres
   full-text search; there is no semantic/vector search.
2. **Generate** — no match (or the user asks for a fresh take)? `runGeneration()` runs the
   whole pipeline on-device: Claude returns schema-validated structured knowledge → the topic,
   components, and relationships are written to Postgres → Gemini generates one labeled
   cutaway infographic from that knowledge → the image is uploaded to Storage → a best-effort
   Claude vision pass locates each component's box on the cutaway for tappable hotspots.
3. **Explore** — the topic screen renders the image with component hotspots and five tabs:
   Components, How it works, Build, Engineering, Sources.
4. **Drill down** — tapping a component can generate a *new* infographic scoped to just that
   component, using the parent topic as context so terminology, scale, and domain stay
   consistent.
5. **Ask** — a contextual AI chat, scoped hard to the current topic (or a selected
   component), with history persisted per user.
6. **Come back** — Home shows the user's recent topics plus a static starter list.

`runGeneration` reports phase transitions (`understanding → knowledge → components → image →
finalizing → complete`) directly to a callback that `useGeneration` mirrors into React state
— there is no server-driven progress channel. A transient failure (429 / 5xx) surfaces a
one-tap retry.

## Architecture in one paragraph

**There is no backend server.** Supabase is Postgres + Auth + Storage only — no Edge
Functions. The Expo app calls the Anthropic (knowledge, chat, vision) and Google Gemini
(image) REST APIs directly from the client over plain `fetch`, and writes results straight
into Postgres/Storage under the signed-in user's own RLS-scoped session.

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

This was a deliberate trade-off — Edge Functions kept hitting Supabase CLI auth/IPv6 friction
in this environment, and the call was made to accept AI provider keys being bundled into the
client (`EXPO_PUBLIC_*` env vars, visible in the installed app binary) rather than fight
deployment further. **Revisit before any public release.** The full reasoning is in
[`AGENTS.md`](AGENTS.md); the diagrams, data model, RLS model, and AI-model table are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Tech stack

- **Expo SDK 54** / React Native 0.81 / React 19, file-based routing via `expo-router`,
  React Compiler + typed routes enabled.
- **Supabase** (`@supabase/supabase-js`) — Postgres, Auth, Storage only.
- **TanStack Query** for server-state fetching/caching. **Zod** for runtime validation of LLM
  responses.
- **React Native Reanimated / Gesture Handler / Bottom Sheet** for the component/chat sheets.
- **react-native-svg**, **expo-image** for the illustration + hotspots.
- **expo-camera** (scan capture), **expo-image-picker** (photo fallback),
  **expo-image-manipulator** (downscale before the vision call).
- TypeScript throughout, path-aliased `@/*` → `src/*`.

> **Expo has changed a lot.** Check the exact versioned docs at
> <https://docs.expo.dev/versions/v57.0.0/> before writing Expo-specific code.

## Getting started

See [`docs/SETUP.md`](docs/SETUP.md). Short version:

```bash
npm install
npx expo start   # then open in Expo Go, a simulator, or the web
```

You need a Supabase project with the `visualpedia_*` migrations applied, an Anthropic API
key, and a Google Gemini API key — all set in `.env` (see [`.env.example`](.env.example)).

## Known limitations / open items

- **Client-bundled API keys.** The whole no-backend design — revisit before any public
  release; anyone who decompiles the app gets your AI provider keys.
- **No server-side moderation/review** of AI-generated content before it's written to the
  shared knowledge graph, beyond `zod` schema validation.
- **No semantic search.** Postgres full-text only — no near-duplicate detection (the same
  subject can be generated twice) and no personalized "Suggested topics". Reintroducing
  embeddings via a non-OpenAI mechanism is a planned follow-up.
- **Image hotspots depend on a best-effort vision pass** — a miss just means fewer tappable
  regions. Needs the `20260828` migration (adds the `components` `UPDATE` policy) for the
  writes to persist under RLS.
- **`visualpedia_generations` Realtime is enabled but unused** — generation runs
  synchronously in the client process; it's there for a possible future
  cross-device/background-generation flow.
