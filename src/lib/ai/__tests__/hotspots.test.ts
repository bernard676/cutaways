import { clampBox } from '@/lib/ai/hotspots';

describe('clampBox', () => {
  it('passes a well-formed box through unchanged', () => {
    expect(clampBox({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
  });

  it('clamps negative origins to 0', () => {
    expect(clampBox({ x: -0.2, y: -0.1, width: 0.3, height: 0.3 })).toEqual({
      x: 0,
      y: 0,
      width: 0.3,
      height: 0.3,
    });
  });

  it('trims a box that would overflow the right/bottom edge', () => {
    expect(clampBox({ x: 0.8, y: 0.9, width: 0.5, height: 0.5 })).toEqual({
      x: 0.8,
      y: 0.9,
      width: expect.closeTo(0.2, 5),
      height: expect.closeTo(0.1, 5),
    });
  });

  it('rejects a degenerate (zero-area) box', () => {
    expect(clampBox({ x: 0.5, y: 0.5, width: 0, height: 0.2 })).toBeNull();
  });

  it('rejects a box pinned to the far edge with no room left', () => {
    expect(clampBox({ x: 0.999, y: 0.5, width: 0.3, height: 0.3 })).toBeNull();
  });
});
