#!/usr/bin/env node

/**
 * One-off backfill for visualpedia_topics rows whose `embedding` is null -- e.g. the batch
 * written while EXPO_PUBLIC_OPENAI_API_KEY had exhausted its quota (embedText() fails closed:
 * generation.ts still creates the topic, just without an embedding). Without an embedding a
 * topic can never be a dedup match, a semantic search hit, or a `visualpedia_related_topics`
 * seed/result, so "Suggested topics" quietly stays on its hardcoded fallback list forever.
 *
 * Mirrors src/lib/ai/embeddings.ts's provider choice (Gemini gets its own embeddings; Anthropic
 * has none of its own and rides on OpenAI) so a topic backfilled here embeds the same way a
 * freshly-generated topic would today. Run with: node scripts/backfill-embeddings.js
 *
 * Uses the service-role key (bypasses RLS) since this updates rows across every user, not just
 * one caller's own topics -- the normal client-side `visualpedia_topics_update_own` policy
 * wouldn't allow that.
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LLM_PROVIDER = process.env.EXPO_PUBLIC_LLM_PROVIDER === 'gemini' ? 'gemini' : 'openai';

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const GEMINI_EMBEDDING_MODEL = process.env.EXPO_PUBLIC_GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 1536; // visualpedia_topics.embedding is a fixed vector(1536) column

async function embedWithOpenAI(text) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: text }),
  });
  if (!response.ok) throw new Error(`OpenAI embeddings ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.data[0].embedding;
}

async function embedWithGemini(text) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        // Must be top-level, not nested under embedContentConfig -- the API silently ignores
        // that wrapper and returns the untruncated 3072-dim embedding instead of erroring.
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: 'SEMANTIC_SIMILARITY',
      }),
    }
  );
  if (!response.ok) throw new Error(`Gemini embeddings ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const values = data.embedding && data.embedding.values;
  if (!values) throw new Error('Gemini returned no embedding');
  return values;
}

function embed(text) {
  return LLM_PROVIDER === 'gemini' ? embedWithGemini(text) : embedWithOpenAI(text);
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  }

  const restHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  const listResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/visualpedia_topics?select=id,title,description&embedding=is.null`,
    { headers: restHeaders }
  );
  if (!listResponse.ok) throw new Error(`Failed to list topics: ${listResponse.status} ${await listResponse.text()}`);
  const topics = await listResponse.json();

  console.log(`Backfilling ${topics.length} topic(s) via ${LLM_PROVIDER} embeddings...`);

  let succeeded = 0;
  const failures = [];

  for (const topic of topics) {
    try {
      const embedding = await embed(`${topic.title}. ${topic.description}`);
      const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/visualpedia_topics?id=eq.${topic.id}`, {
        method: 'PATCH',
        headers: { ...restHeaders, Prefer: 'return=minimal' },
        // embedding_provider tracks which model's vector space this row is in, so the
        // duplicate-check can compare like-for-like (see 20260828 migration).
        body: JSON.stringify({ embedding, embedding_provider: LLM_PROVIDER }),
      });
      if (!updateResponse.ok) throw new Error(`update failed ${updateResponse.status}: ${await updateResponse.text()}`);
      succeeded += 1;
      console.log(`  ok   ${topic.title}`);
    } catch (err) {
      failures.push({ title: topic.title, id: topic.id, error: err instanceof Error ? err.message : String(err) });
      console.log(`  FAIL ${topic.title}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n${succeeded}/${topics.length} embedded.`);
  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  ${f.id} ${f.title}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
