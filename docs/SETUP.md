# Setup

Everything needed to run Sketch Studios locally. For what the app *is* see
[`README.md`](../README.md); for how it's built see [`ARCHITECTURE.md`](ARCHITECTURE.md);
for the no-backend trade-off see [`AGENTS.md`](../AGENTS.md).

## Prerequisites

- Node.js and npm
- A Supabase project (Postgres + Auth + Storage) with the `visualpedia_*`-prefixed schema
  applied (see [Database setup](#database-setup)). `pg_trgm` is enabled by the init migration.
- An **Anthropic API key** (structured knowledge, chat, vision)
- A **Google Gemini API key** (infographic images) — from
  [Google AI Studio](https://aistudio.google.com/projects)
  
## Database setup

Apply the migrations in `supabase/migrations/` **in order** (Supabase CLI or dashboard SQL
editor) against your project. They create the `visualpedia_*` schema, RLS policies, the
`visualpedia-topic-images` storage bucket, and the full-text search index. The full list is
in [`ARCHITECTURE.md` → Migrations](ARCHITECTURE.md#migrations).

## Install & run

```bash
npm install
npx expo start
```

Then open the app in:

- [Expo Go](https://expo.dev/go) (fastest way to develop against this project)
- an iOS Simulator / Android Emulator
- a [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- the web (`npm run web`) — `expo-router` web output is `single` in `app.json`

## Scripts

| Script | What it does |
| --- | --- |
| `npm run ios` / `npm run android` / `npm run web` | Start on a specific platform |
| `npm run lint` | `expo lint` |
| `npm test` | Jest (`jest-expo` preset) — unit tests for the pure logic in `src/lib`; see [`ARCHITECTURE.md` → Testing](ARCHITECTURE.md#testing) |
| `npm run reset-project` | Expo's stock template-reset script — not needed here (`src/app` is a real app, not starter boilerplate) |

> **Expo has changed a lot.** Before writing Expo-specific code, check the exact versioned
> docs at <https://docs.expo.dev/versions/v57.0.0/> rather than relying on training-data
> knowledge of older Expo APIs.
