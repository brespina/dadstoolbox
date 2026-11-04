import { describe, expect, it } from 'vitest';
import { fewestKeys } from './fewest';
import { feed, motions, startState, type Motions, type VimState } from './vim';

const { h, j, k, l, w, b, e, W, B, E, $, f, F, t, T } = motions;
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

  it('counts a find as its keys and character, with a count in front', () => {
    expect(fewest('a,b,c,d', [0, 0], [0, 1], { f })).toBe(2);
    expect(fewest('a,b,c,d', [0, 0], [0, 5], { f })).toBe(3);
    expect(fewest('a,b,c,d', [0, 6], [0, 1], { F })).toBe(3);
    // Just short of a character: `tc`, and `Tb` from the other side.
    expect(fewest('a,b,c,d', [0, 0], [0, 3], { t })).toBe(2);
    expect(fewest('a,b,c,d', [0, 6], [0, 3], { T })).toBe(2);
    // Only characters on the cursor's line can be found.
    expect(fewest('a,b\nxyz', [0, 0], [1, 2], { f, j })).toBe(3);
  });

  it('uses ; and , after a find, as one key each', () => {
    const repeat = { ';': motions[';'], ',': motions[','] };
    expect(fewest('a,b,c,d', [0, 0], [0, 3], { f, ...repeat })).toBe(3);
    // Nothing to repeat before a find.
    expect(fewest('a,b,c,d', [0, 0], [0, 3], repeat)).toBeUndefined();
    // The find is kept when the cursor moves to another line: `f,` `j` `;`.
    expect(fewest('x,y\nx,y,z', [0, 0], [1, 3], { f, j, ';': motions[';'] })).toBe(4);
    // `F,` goes back to the comma, and `,` forward to the next one.
    expect(fewest('a,b,c', [0, 2], [0, 3], { F, ',': motions[','] })).toBe(3);
  });

  it('counts gg and G as their keys, and a line number as its digits', () => {
    const text = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl';
    expect(fewest(text, [5, 0], [0, 0], { gg: motions.gg })).toBe(2);
    expect(fewest(text, [5, 0], [11, 0], { G: motions.G })).toBe(1);
    expect(fewest(text, [5, 0], [2, 0], { G: motions.G, gg: motions.gg })).toBe(2);
    expect(fewest(text, [5, 0], [10, 0], { G: motions.G })).toBe(3);
    expect(fewest(text, [5, 0], [0, 0], { G: motions.G })).toBe(2);
    expect(fewest('  a\n  b\nc', [2, 0], [0, 2], { gg: motions.gg })).toBe(2);
  });

  it('counts } { and % as one key, and a count of paragraphs as its digits', () => {
    const text = 'a(b)\n\nc\n\nd\n\ne{\nf\n}';
    const paragraphs = { '}': motions['}'], '{': motions['{'], '%': motions['%'] };
    expect(fewest(text, [0, 0], [1, 0], paragraphs)).toBe(1);
    expect(fewest(text, [0, 0], [3, 0], paragraphs)).toBe(2);
    expect(fewest(text, [0, 0], [5, 0], paragraphs)).toBe(2);
    expect(fewest(text, [0, 0], [5, 0], { ...paragraphs, j: motions.j })).toBe(2);
    expect(fewest(text, [8, 0], [0, 0], paragraphs)).toBe(2);
    expect(fewest(text, [0, 0], [0, 3], paragraphs)).toBe(1);
    expect(fewest(text, [0, 3], [0, 1], paragraphs)).toBe(1);
    expect(fewest(text, [6, 1], [8, 0], paragraphs)).toBe(1);
    // The last paragraph asked for goes to the end of the text: 4} is the 4th and last.
    expect(fewest(text, [0, 0], [8, 0], paragraphs)).toBe(2);
    expect(fewest(text, [0, 0], [8, 0], { '}': motions['}'], G: motions.G })).toBe(1);
  });

  it('agrees with typing every key sequence into the engine', () => {
    // Every sequence of up to 4 keys (digits and the characters of the text too), typed
    // through `feed`: the shortest one to each place is the fewest keys the search must
    // give. Typing the same state again with no fewer keys can't lead anywhere new.
    const text = ['abcd,fgh(jk),o', '', '  e{f},g', 'ij,,k', '', 'l[m]n'];
    const alphabet = new Set([...Object.keys(motions).join(''), ...'123456789', ...text.join('')]);
    for (const [line, col] of [
      [0, 0],
      [3, 1],
      [2, 3],
    ] as const) {
      const typed = new Map<string, number>();
      const seen = new Map<string, number>();
      const start = startState({ line, col });
      const walk = (state: VimState, length: number) => {
        const { cursor } = state;
        const place = `${cursor.line}:${cursor.col}`;
        if (length < (typed.get(place) ?? Infinity)) typed.set(place, length);
        if (length === 4) return;
        const key = JSON.stringify(state);
        if ((seen.get(key) ?? Infinity) <= length) return;
        seen.set(key, length);
        for (const letter of alphabet) walk(feed(text, state, letter, motions).state, length + 1);
      };
      walk(start, 0);
      typed.delete(`${line}:${col}`);
      const found = fewestKeys(text, start.cursor, motions, 4);
      expect([...found].sort()).toEqual([...typed].sort());
    }
  });

  it('stops looking after the most keys asked for', () => {
    const far = { line: 0, col: 0, want: 0 };
    const reach = fewestKeys(['abcdef', 'abcdef'], far, lesson1, 1);
    expect([...reach.keys()].sort()).toEqual(['0:1', '1:0']);
  });
});
