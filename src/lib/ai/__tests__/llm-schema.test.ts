import { toGeminiSchema } from '@/lib/ai/llm';

describe('toGeminiSchema', () => {
  it('uppercases the type keyword at every level', () => {
    const out = toGeminiSchema({
      type: 'object',
      properties: {
        title: { type: 'string' },
        components: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } } } },
      },
    });
    expect(out.type).toBe('OBJECT');
    expect((out.properties as any).title.type).toBe('STRING');
    expect((out.properties as any).components.type).toBe('ARRAY');
    expect((out.properties as any).components.items.type).toBe('OBJECT');
    expect((out.properties as any).components.items.properties.name.type).toBe('STRING');
  });

  it('strips additionalProperties, which Gemini rejects', () => {
    const out = toGeminiSchema({
      type: 'object',
      additionalProperties: false,
      properties: { a: { type: 'string' } },
      items: { type: 'object', additionalProperties: false, properties: {} },
    });
    expect('additionalProperties' in out).toBe(false);
    expect('additionalProperties' in (out.items as object)).toBe(false);
  });

  it('preserves non-type fields like enum and required', () => {
    const out = toGeminiSchema({
      type: 'string',
      enum: ['partOf', 'causes'],
    });
    expect(out.enum).toEqual(['partOf', 'causes']);
  });
});
