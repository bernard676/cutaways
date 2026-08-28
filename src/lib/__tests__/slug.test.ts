import { toSlug } from '@/lib/slug';

describe('toSlug', () => {
  it('lowercases and kebab-cases', () => {
    expect(toSlug('Suspension Bridge')).toBe('suspension-bridge');
  });

  it('collapses runs of non-alphanumerics into a single dash', () => {
    expect(toSlug('Jet   Engine  ///  Turbofan')).toBe('jet-engine-turbofan');
  });

  it('strips leading and trailing dashes', () => {
    expect(toSlug('  -- Human Heart -- ')).toBe('human-heart');
  });

  it('drops accented and symbol characters', () => {
    expect(toSlug('Crème brûlée (dessert)!')).toBe('cr-me-br-l-e-dessert');
  });

  it('returns an empty string when there is nothing slug-able', () => {
    expect(toSlug('—— ½ ——')).toBe('');
  });
});
