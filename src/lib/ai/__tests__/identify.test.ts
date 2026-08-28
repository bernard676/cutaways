import { cleanLabel, normalizeIdentification } from '@/lib/ai/identify';

describe('cleanLabel', () => {
  it('strips a leading article and surrounding whitespace', () => {
    expect(cleanLabel('  a suspension bridge ')).toBe('suspension bridge');
    expect(cleanLabel('The Human Heart')).toBe('Human Heart');
  });

  it('maps the model’s "I don’t know" spellings to null', () => {
    for (const v of ['null', 'none', 'N/A', 'unknown', 'unclear', 'unidentifiable', 'nothing']) {
      expect(cleanLabel(v)).toBeNull();
    }
  });

  it('treats empty / missing input as null', () => {
    expect(cleanLabel('')).toBeNull();
    expect(cleanLabel(null)).toBeNull();
    expect(cleanLabel(undefined)).toBeNull();
  });
});

describe('normalizeIdentification', () => {
  it('returns the empty result for a malformed body', () => {
    expect(normalizeIdentification('not json-ish')).toEqual({
      label: null,
      detail: null,
      alternatives: [],
    });
    expect(normalizeIdentification({ label: 42 })).toEqual({
      label: null,
      detail: null,
      alternatives: [],
    });
  });

  it('keeps the label, detail, and de-duped alternatives on a good body', () => {
    expect(
      normalizeIdentification({
        label: 'disc brake caliper',
        detail: 'a fixed opposed-piston caliper, aluminium body',
        alternatives: ['brake caliper', 'Disc Brake Caliper', 'brake assembly'],
      })
    ).toEqual({
      label: 'disc brake caliper',
      detail: 'a fixed opposed-piston caliper, aluminium body',
      // exact (case-insensitive) echo of the label is dropped, rest kept in order
      alternatives: ['brake caliper', 'brake assembly'],
    });
  });

  it('drops detail and caps alternatives when there is no usable label', () => {
    expect(
      normalizeIdentification({ label: 'none', detail: 'blurry', alternatives: ['a', 'b'] })
    ).toEqual({ label: null, detail: null, alternatives: ['a', 'b'] });
  });

  it('limits alternatives to four', () => {
    const result = normalizeIdentification({
      label: 'jet engine',
      alternatives: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(result.alternatives).toEqual(['a', 'b', 'c', 'd']);
  });
});
