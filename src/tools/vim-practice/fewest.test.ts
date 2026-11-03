import { describe, expect, it } from 'vitest';
import { fewestKeys } from './fewest';
import { motions, type Motions } from './vim';

const { h, j, k, l, w, b, e, W, B, E, $ } = motions;
const lesson1 = { h, j, k, l };

function fewest(text: string, from: [number, number], to: [number, number], allowed: Motions) {
  const start = { line: from[0], col: from[1], want: from[1] };
  return fewestKeys(text.split('\n'), start, allowed).get(`${to[0]}:${to[1]}`);
}

describe('fewestKeys', () => {
  it('counts a count as the digits typed', () => {
    expect(fewest('abcdef', [0, 0], [0, 1], lesson1)).toBe(1);
    expect(fewest('abcdef', [0, 0], [0, 3], lesson1)).toBe(2);
    expect(fewest('x'.repeat(30), [0, 0], [0, 12], lesson1)).toBe(3);
    expect(fewest('a\nb\nc\nd', [0, 0], [3, 0], lesson1)).toBe(2);
  });

  it('mixes motions, and takes the cheapest', () => {
    expect(fewest('abc\nabc', [0, 0], [1, 1], lesson1)).toBe(2);
    expect(fewest('abcdef', [0, 0], [0, 5], lesson1)).toBe(2);
    expect(fewest('abcdef', [0, 0], [0, 5], { ...lesson1, $ })).toBe(1);
    expect(fewest('foo bar baz', [0, 0], [0, 8], { ...lesson1, w, b, e, W, B, E })).toBe(2);
    expect(fewest('foo bar baz', [0, 0], [0, 6], { ...lesson1, w, b, e, W, B, E })).toBe(2);
  });

  it('uses the column j wants', () => {
    // `2j` passes the short line and comes back to the column.
    expect(fewest('abcdef\nab\nabcdef', [0, 5], [2, 5], lesson1)).toBe(2);
    // `3$`: the end of the line two lines down.
    expect(fewest('abc\nab\nabcdef', [0, 0], [2, 5], { j, $ })).toBe(2);
  });

  it('leaves out places the motions cannot reach, and the start', () => {
    expect(fewest('foo bar', [0, 0], [0, 1], { w })).toBeUndefined();
    expect(fewest('foo bar', [0, 0], [0, 0], lesson1)).toBeUndefined();
  });

  it('stops looking after the most keys asked for', () => {
    const far = { line: 0, col: 0, want: 0 };
    const reach = fewestKeys(['abcdef', 'abcdef'], far, lesson1, 1);
    expect([...reach.keys()].sort()).toEqual(['0:1', '1:0']);
  });
});
