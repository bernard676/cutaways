// Client-side LLM calls (no backend) -- see AGENTS.md for why. Plain fetch against the
// OpenAI/Anthropic REST APIs rather than their Node SDKs, which assume a Node runtime.

import { z } from 'zod';

import { throwCleanApiError } from '@/lib/ai/errors';
import { logger } from '@/lib/logger';
import { getLlmProvider } from '@/state/settings-store';

const GeneratedComponentSchema = z.object({
  name: z.string(),
  description: z.string(),
  does: z.string(),
  why: z.string(),
  materials: z.array(z.string()),
});

const GeneratedRelationshipSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum([
    'partOf',
    'connectedTo',
    'supports',
    'transfersLoadTo',
    'madeOf',
    'powers',
    'causes',
  ]),
  description: z.string(),
});

// Runtime validation for the LLM's JSON response -- a blind `JSON.parse(...) as T` cast would
// otherwise let a malformed/hallucinated response (missing field, wrong shape) reach the DB
// insert with only a cryptic downstream error, or silently write bad data (no server-side
// review step now that generation runs client-side). GeneratedKnowledge is inferred from this
// schema rather than hand-duplicated, so the two can't drift apart.
const GeneratedKnowledgeSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  domain: z.string(),
  overview: z.string(),
  materials: z.array(z.object({ name: z.string(), spec: z.string(), why: z.string() })),
  construction: z.array(
    z.object({ order: z.number().int(), title: z.string(), description: z.string() })
  ),
  science: z.object({ principle: z.string(), formula: z.string(), formulaNote: z.string() }),
  failureModes: z.array(
    z.object({ name: z.string(), cause: z.string(), mitigation: z.string() })
  ),
  sources: z.array(z.object({ title: z.string(), publisher: z.string() })),
  relatedTopicSlugs: z.array(z.string()),
  /** Ordered top-to-bottom causal/load chain, e.g. "People & vehicles" -> "Deck" -> "Main cable" -> "Foundation". */
  flow: z.array(z.string()),
  components: z.array(GeneratedComponentSchema),
  relationships: z.array(GeneratedRelationshipSchema),
  imagePrompt: z.string(),
});

export type GeneratedComponent = z.infer<typeof GeneratedComponentSchema>;
export type GeneratedRelationship = z.infer<typeof GeneratedRelationshipSchema>;
export type GeneratedKnowledge = z.infer<typeof GeneratedKnowledgeSchema>;

// Resolved once at module load and reused both in the API calls below and by the settings
// screen, so the UI can never show a model name that drifts from what's actually requested.
export const OPENAI_TEXT_MODEL = process.env.EXPO_PUBLIC_OPENAI_TEXT_MODEL ?? 'gpt-4o-mini';
export const ANTHROPIC_TEXT_MODEL = process.env.EXPO_PUBLIC_ANTHROPIC_TEXT_MODEL ?? 'claude-sonnet-5';
export const GEMINI_TEXT_MODEL = process.env.EXPO_PUBLIC_GEMINI_TEXT_MODEL ?? 'gemini-flash-latest';

function parseGeneratedKnowledge(raw: unknown, provider: string): GeneratedKnowledge {
  const result = GeneratedKnowledgeSchema.safeParse(raw);
  if (!result.success) {
    logger.error('llm', `${provider} response failed schema validation`, result.error, {
      raw,
    });
    throw new Error(`${provider} returned an unexpected response. Try again.`);
  }
  return result.data;
}

const SYSTEM_PROMPT = `You are the knowledge engine behind Visualpedia, a visual encyclopedia app. \
A user searches for a physical object, structure, machine, biological system, or technical \
concept and you produce structured, accurate, textbook-quality knowledge about it -- the kind \
an engineering textbook, architectural reference, or museum placard would contain.

Rules:
- If the subject is a real assembly with distinct physical parts, break it into 5-10 real \
components (not vague categories). If the subject is already a single atomic part that doesn't \
meaningfully decompose further (e.g. a single bolt, a single wire), use an EMPTY components array \
and an empty relationships array instead of inventing sub-parts -- this is expected and correct \
for leaf-level topics reached by drilling into a component of something larger.
- Every relationship must reference components by their exact "name" string.
- Prefer concrete relationship types: partOf, connectedTo, supports, transfersLoadTo, madeOf, powers, causes.
- flow is a SEPARATE, simpler representation of the main causal/load path from cause to effect (or \
top to bottom), as a short ordered list of stage labels a reader skims in seconds -- e.g. \
["People & vehicles", "Deck", "Suspender cables", "Main cable", "Towers & anchorages", "Foundations", "Bedrock / soil"]. \
It does not need to name every component.
- construction/manufacturing steps should be in real chronological order.
- science.formula should be a short real formula/equation relevant to the subject if one exists \
(otherwise a short defining relationship expressed as text); formulaNote briefly explains it in plain language.
- Each material needs a concrete spec (grade, strength, composition -- not just a name).
- Each failure mode needs a real physical cause and a real mitigation used in practice.
- Each source needs a real publisher/organization name (book, standard, or institution) -- do not invent URLs.
- imagePrompt is ONE sentence describing only the central 3D cutaway subject and view angle \
(e.g. "the reinforced-concrete foundation of a multi-story building, cut away to show footings, \
walls, and drainage both above and below grade") -- it gets embedded into a larger infographic \
template that already handles labeling, panels, and style, so do not describe layout, panels, \
callouts, or visual style here, and never mention photorealism or photography.
- slug must be lowercase-kebab-case and url-safe.`;

const KNOWLEDGE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    domain: { type: 'string' },
    overview: { type: 'string' },
    materials: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          spec: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['name', 'spec', 'why'],
        additionalProperties: false,
      },
    },
    construction: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          order: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['order', 'title', 'description'],
        additionalProperties: false,
      },
    },
    science: {
      type: 'object',
      properties: {
        principle: { type: 'string' },
        formula: { type: 'string' },
        formulaNote: { type: 'string' },
      },
      required: ['principle', 'formula', 'formulaNote'],
      additionalProperties: false,
    },
    failureModes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          cause: { type: 'string' },
          mitigation: { type: 'string' },
        },
        required: ['name', 'cause', 'mitigation'],
        additionalProperties: false,
      },
    },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, publisher: { type: 'string' } },
        required: ['title', 'publisher'],
        additionalProperties: false,
      },
    },
    relatedTopicSlugs: { type: 'array', items: { type: 'string' } },
    flow: { type: 'array', items: { type: 'string' } },
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          does: { type: 'string' },
          why: { type: 'string' },
          materials: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'description', 'does', 'why', 'materials'],
        additionalProperties: false,
      },
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'partOf',
              'connectedTo',
              'supports',
              'transfersLoadTo',
              'madeOf',
              'powers',
              'causes',
            ],
          },
          description: { type: 'string' },
        },
        required: ['from', 'to', 'type', 'description'],
        additionalProperties: false,
      },
    },
    imagePrompt: { type: 'string' },
  },
  required: [
    'title',
    'slug',
    'description',
    'domain',
    'overview',
    'materials',
    'construction',
    'science',
    'failureModes',
    'sources',
    'relatedTopicSlugs',
    'flow',
    'components',
    'relationships',
    'imagePrompt',
  ],
  additionalProperties: false,
} as const;

export async function generateStructuredKnowledge(query: string): Promise<GeneratedKnowledge> {
  const provider = getLlmProvider();
  if (provider === 'anthropic') return generateWithAnthropic(query);
  if (provider === 'gemini') return generateWithGemini(query);
  return generateWithOpenAI(query);
}

// Gemini's responseSchema is an OpenAPI-3.0 subset (uppercase Type enum, no
// additionalProperties) rather than plain JSON Schema, so the shared KNOWLEDGE_JSON_SCHEMA
// needs converting before it can be sent as generationConfig.responseSchema.
function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const { additionalProperties: _additionalProperties, ...rest } = schema;
  const out: Record<string, unknown> = { ...rest };
  if (typeof out.type === 'string') out.type = out.type.toUpperCase();
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties as Record<string, Record<string, unknown>>).map(
        ([key, value]) => [key, toGeminiSchema(value)]
      )
    );
  }
  if (out.items) out.items = toGeminiSchema(out.items as Record<string, unknown>);
  return out;
}

async function generateWithOpenAI(query: string): Promise<GeneratedKnowledge> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY is required when LLM_PROVIDER=openai');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_TEXT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Explain how this works: ${query}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'structured_knowledge', strict: true, schema: KNOWLEDGE_JSON_SCHEMA },
      },
    }),
  });

  if (!response.ok) {
    await throwCleanApiError('llm', 'OpenAI', response);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no content');
  return parseGeneratedKnowledge(JSON.parse(content), 'OpenAI');
}

async function generateWithAnthropic(query: string): Promise<GeneratedKnowledge> {
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
      model: ANTHROPIC_TEXT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Explain how this works: ${query}` }],
      tools: [
        {
          name: 'emit_structured_knowledge',
          description: 'Emit the structured knowledge for the requested topic.',
          input_schema: KNOWLEDGE_JSON_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_structured_knowledge' },
    }),
  });

  if (!response.ok) {
    await throwCleanApiError('llm', 'Anthropic', response);
  }

  const data = await response.json();
  const toolUse = (data.content as { type: string; input?: unknown }[])?.find(
    (block) => block.type === 'tool_use'
  );
  if (!toolUse) throw new Error('Claude returned no tool call');
  return parseGeneratedKnowledge(toolUse.input, 'Anthropic');
}

async function generateWithGemini(query: string): Promise<GeneratedKnowledge> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is required when LLM_PROVIDER=gemini');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Explain how this works: ${query}` }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(KNOWLEDGE_JSON_SCHEMA),
        },
      }),
    }
  );

  if (!response.ok) {
    await throwCleanApiError('llm', 'Gemini', response);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return parseGeneratedKnowledge(JSON.parse(text), 'Gemini');
}
