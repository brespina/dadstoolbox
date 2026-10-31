import { describe, expect, it } from 'vitest';
import { codeParts, inCorner } from './shapes';

describe('the shapes of a code', () => {
  const size = 21;

  it('draws the three big corner squares whole, whatever is dark', () => {
    const parts = codeParts(size, () => false, 'square', 'square');
    // Each corner is a ring and a centre.
    expect(parts).toHaveLength(6);
    expect(parts.filter((p) => p.hole)).toEqual([
      { outer: { x: 0, y: 0, size: 7, radius: 0 }, hole: { x: 1, y: 1, size: 5, radius: 0 } },
      { outer: { x: 14, y: 0, size: 7, radius: 0 }, hole: { x: 15, y: 1, size: 5, radius: 0 } },
      { outer: { x: 0, y: 14, size: 7, radius: 0 }, hole: { x: 1, y: 15, size: 5, radius: 0 } },
    ]);
  });

  it('draws one dot for each dark square outside the corners, in the dot shape', () => {
    const dark = new Set(['8,10', '3,3', '10,8']); // (3,3) is inside a corner
    const parts = codeParts(size, (r, c) => dark.has(`${r},${c}`), 'round', 'square');
    expect(parts.slice(6)).toEqual([
      { outer: { x: 10, y: 8, size: 1, radius: 0.5 } },
      { outer: { x: 8, y: 10, size: 1, radius: 0.5 } },
    ]);
  });

  it('gives each corner shape its own rounding, the ring one thickness all the way round', () => {
    const radii = (shape: 'square' | 'rounded' | 'round') =>
      codeParts(size, () => false, 'square', shape)
        .slice(0, 2)
        .map((p) => [p.outer.radius, p.hole?.radius]);
    expect(radii('square')).toEqual([
      [0, 0],
      [0, undefined],
    ]);
    expect(radii('rounded')).toEqual([
      [2, 1],
      [1, undefined],
    ]);
    // A circle: the ring's outer edge is half its width, and the hole one thickness less.
    expect(radii('round')).toEqual([
      [3.5, 2.5],
      [1.5, undefined],
    ]);
  });

  it('keeps the dot shape and the corner shape apart', () => {
    const parts = codeParts(size, (r, c) => r === 9 && c === 9, 'rounded', 'round');
    expect(parts.at(-1)!.outer.radius).toBe(0.3);
    expect(parts[0]!.outer.radius).toBe(3.5);
  });

  it('knows which squares are in a corner', () => {
    expect(inCorner(size, 0, 0)).toBe(true);
    expect(inCorner(size, 6, 20)).toBe(true);
    expect(inCorner(size, 20, 6)).toBe(true);
    // The light border of a corner is not part of it, and nor is the far corner.
    expect(inCorner(size, 7, 7)).toBe(false);
    expect(inCorner(size, 20, 20)).toBe(false);
  });
});
