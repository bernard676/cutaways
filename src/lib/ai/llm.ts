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
  /** Continuous prose explaining how the components work together, 2-4 paragraphs separated by blank lines. */
  howItWorks: z.string(),
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

/**
 * A smaller/less-contested model to retry against when the primary model comes back overloaded
 * (429/5xx) -- offered as a one-tap "retry with a different model" action rather than just
 * resubmitting into the same outage. Deliberately env-overridable and defaulted to rolling
 * `-latest` aliases rather than a pinned dated snapshot (e.g. `gemini-2.5-flash`) -- pinned
 * snapshots get sunset for new users over time (that's what broke the previous hardcoded
 * fallback here), while `-latest` aliases are Google/Anthropic/OpenAI's own promise to keep
 * pointing at a currently-supported model. `null` means there's no meaningfully smaller model
 * to fall back to (OPENAI_TEXT_MODEL is already the small/cheap tier), so a retry there just
 * resubmits the same model.
 */
export function getFallbackTextModel(provider: 'openai' | 'anthropic' | 'gemini'): string | null {
  if (provider === 'gemini') {
    return process.env.EXPO_PUBLIC_GEMINI_TEXT_FALLBACK_MODEL ?? 'gemini-flash-lite-latest';
  }
  if (provider === 'anthropic') {
    return process.env.EXPO_PUBLIC_ANTHROPIC_TEXT_FALLBACK_MODEL ?? 'claude-haiku-4-5-20251001';
  }
  return null;
}

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

const SYSTEM_PROMPT = `You are the knowledge engine behind Sketch Studios, a visual encyclopedia app. \
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
- howItWorks is 2-4 paragraphs of flowing prose (separated by blank lines, no bullet points, no \
headings) that walks a reader through how the components function together as a system -- refer \
to components by the exact same "name" strings used in the components array, follow the real \
causal/mechanical order (what happens first, what that enables, what depends on what), and explain \
*why* each handoff works, not just that it happens. Write it like a knowledgeable engineer \
explaining the system out loud, not a labeled diagram caption.
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
    howItWorks: { type: 'string' },
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
    'howItWorks',
    'components',
    'relationships',
    'imagePrompt',
  ],
  additionalProperties: false,
} as const;

/**
 * `context` is passed when generating knowledge for a component drilled into from a parent
 * topic (see ComponentDetailSheet's "Generate new infographic" action) -- it keeps terminology,
 * scale, and domain consistent with the system the component came from instead of generating it
 * in isolation.
 */
function buildUserPrompt(query: string, context?: string): string {
  if (!context) return `Explain how this works: ${query}`;
  return (
    `Explain how this works: ${query}\n\n` +
    `Context: "${query}" is a component of a larger system already described as follows -- ${context} ` +
    `Keep your explanation of "${query}" consistent with that parent system (same domain conventions, ` +
    `compatible scale and materials), but still write the full structured knowledge specifically for ` +
    `"${query}" itself, drilling one level deeper into it.`
  );
}

export async function generateStructuredKnowledge(
  query: string,
  context?: string,
  // Overrides the provider's default model for this one call -- used to retry against
  // getFallbackTextModel() after an overloaded (429/5xx) failure.
  modelOverride?: string
): Promise<GeneratedKnowledge> {
  const provider = getLlmProvider();
  if (provider === 'anthropic') return generateWithAnthropic(query, context, modelOverride);
  if (provider === 'gemini') return generateWithGemini(query, context, modelOverride);
  return generateWithOpenAI(query, context, modelOverride);
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

async function generateWithOpenAI(
  query: string,
  context?: string,
  modelOverride?: string
): Promise<GeneratedKnowledge> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY is required when LLM_PROVIDER=openai');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelOverride ?? OPENAI_TEXT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(query, context) },
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

async function generateWithAnthropic(
  query: string,
  context?: string,
  modelOverride?: string
): Promise<GeneratedKnowledge> {
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
      model: modelOverride ?? ANTHROPIC_TEXT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(query, context) }],
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

async function generateWithGemini(
  query: string,
  context?: string,
  modelOverride?: string
): Promise<GeneratedKnowledge> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is required when LLM_PROVIDER=gemini');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelOverride ?? GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildUserPrompt(query, context) }] }],
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
