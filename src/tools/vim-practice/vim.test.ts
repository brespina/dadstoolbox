import { describe, expect, it } from 'vitest';
import { feed, motions, startState, type Motions } from './vim';

/**
 * Types `keys` (one key per character, `⎋` for Escape) into `text`, whose `|` marks the
 * cursor (on the character after it), and returns the text with `|` where the cursor
 * ends up.
 */
function keys(text: string, typed: string, allowed: Motions = motions): string {
  const before = text.indexOf('|');
  const lines = (text.slice(0, before) + text.slice(before + 1)).split('\n');
  const line = text.slice(0, before).split('\n').length - 1;
  const col = before - (text.lastIndexOf('\n', before - 1) + 1);
  let state = startState({ line, col });
  for (const key of typed) state = feed(lines, state, key === '⎋' ? 'Escape' : key, allowed).state;
  const { cursor } = state;
  return lines
    .map((l, i) => (i === cursor.line ? l.slice(0, cursor.col) + '|' + l.slice(cursor.col) : l))
    .join('\n');
}

describe('h and l', () => {
  it('move one character, or count characters', () => {
    expect(keys('|abcdef', 'l')).toBe('a|bcdef');
    expect(keys('|abcdef', '3l')).toBe('abc|def');
    expect(keys('abc|def', 'h')).toBe('ab|cdef');
    expect(keys('abc|def', '2h')).toBe('a|bcdef');
  });

  it('stop at the ends of the line and never wrap', () => {
    expect(keys('ab|c\ndef', 'l')).toBe('ab|c\ndef');
    expect(keys('|abcdef', '99l')).toBe('abcde|f');
    expect(keys('abc\n|def', 'h')).toBe('abc\n|def');
    expect(keys('ab|cdef', '9h')).toBe('|abcdef');
  });
});

describe('j and k', () => {
  it('move down and up lines, or count lines, and stop at the first and last line', () => {
    expect(keys('a|bc\ndef\nghi', 'j')).toBe('abc\nd|ef\nghi');
    expect(keys('a|bc\ndef\nghi', '2j')).toBe('abc\ndef\ng|hi');
    expect(keys('a|bc\ndef\nghi', '12j')).toBe('abc\ndef\ng|hi');
    expect(keys('abc\ndef\ng|hi', 'k')).toBe('abc\nd|ef\nghi');
    expect(keys('abc\ndef\ng|hi', '9k')).toBe('a|bc\ndef\nghi');
    expect(keys('a|bc\ndef', 'k')).toBe('a|bc\ndef');
  });

  it('land on the last character of a shorter line, and keep the column wanted', () => {
    expect(keys('abcd|ef\nab\nabcdef', 'j')).toBe('abcdef\na|b\nabcdef');
    expect(keys('abcd|ef\nab\nabcdef', 'jj')).toBe('abcdef\nab\nabcd|ef');
    expect(keys('abcd|ef\nab\nabcdef', '2j')).toBe('abcdef\nab\nabcd|ef');
  });

  it('land on an empty line, still keeping the column wanted', () => {
    expect(keys('ab|cd\n\nabcd', 'j')).toBe('abcd\n|\nabcd');
    expect(keys('ab|cd\n\nabcd', 'jj')).toBe('abcd\n\nab|cd');
  });

  it('forget the column wanted once h or l moves', () => {
    expect(keys('abcd|ef\nab\nabcdef', 'jhj')).toBe('abcdef\nab\n|abcdef');
  });
});

describe('counts and Escape', () => {
  it('take several digits', () => {
    expect(keys('|' + 'x'.repeat(30), '12l')).toBe('x'.repeat(12) + '|' + 'x'.repeat(18));
  });

  it('Escape cancels a half-typed count', () => {
    expect(keys('|abcdef', '3⎋l')).toBe('a|bcdef');
  });

  it('a key that is not an allowed motion is ignored, and drops the count', () => {
    const result = feed(['abc'], startState({ line: 0, col: 0 }), 'x', motions);
    expect(result.outcome).toBe('ignored');
    expect(result.state.cursor).toMatchObject({ line: 0, col: 0 });
    expect(keys('|abcdef', '3xl')).toBe('a|bcdef');
    const { h, j, k } = motions;
    expect(keys('|abcdef', 'l', { h, j, k })).toBe('|abcdef');
  });

  it('reports what each key did', () => {
    let state = startState({ line: 0, col: 0 });
    const outcomes = [...'3l', 'Escape', 'Escape', 'q'].map((key) => {
      const result = feed(['abcdef'], state, key, motions);
      state = result.state;
      return result.outcome;
    });
    expect(outcomes).toEqual(['count', 'moved', 'cancelled', 'cancelled', 'ignored']);
  });
});
