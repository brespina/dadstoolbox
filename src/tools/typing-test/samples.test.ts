import { describe, expect, it } from 'vitest';
import { newTest, press, score, type KeyPress, type TypingTest } from './typing';
import { samples } from './samples';

/** Presses one character key each, a second apart from 0, or at the given times. */
function typeKeys(test: TypingTest, keys: string, times?: number[]): TypingTest {
  return [...keys].reduce((current, char, i) => {
    const key: KeyPress = { type: 'char', char, at: times?.[i] ?? i * 1000 };
    return press(current, key);
  }, test);
}

const wordsTest = (words: string[]) => newTest({ kind: 'words', count: words.length }, words);

describe('the speed at each second of a test', () => {
  it('has one sample for each second, counted from the first key press', () => {
    // "the" + space + "cat", a key a second, so 7 key presses over 6 seconds. Each sample
    // is the speed so far: "the" and its space (4 characters) are done at second 3, and
    // "cat" (3 characters, no space after it) at second 6.
    const test = typeKeys(wordsTest(['the', 'cat']), 'the cat');
    expect(samples(test)).toEqual([
      { second: 1, wpm: 0, raw: 24 },
      { second: 2, wpm: 0, raw: 18 },
      { second: 3, wpm: 16, raw: 16 },
      { second: 4, wpm: 12, raw: 15 },
      { second: 5, wpm: 10, raw: 14 },
      { second: 6, wpm: 14, raw: 14 },
    ]);
  });

  it('counts a word typed wrong toward raw only, and ends on the same speed as the score', () => {
    // "thx" is wrong: nothing counts toward wpm until "cat" is done.
    const test = typeKeys(wordsTest(['the', 'cat']), 'thx cat');
    const result = samples(test);
    expect(result.map((s) => s.wpm)).toEqual([0, 0, 0, 0, 0, 6]);
    expect(result.at(-1)).toMatchObject({ wpm: score(test).wpm, raw: score(test).rawWpm });
  });

  it('ends with a sample at the moment the test ended, when that is not a whole second', () => {
    // "a", a space, and "b" at 2.5 seconds, which ends the test.
    const test = typeKeys(wordsTest(['a', 'b']), 'a b', [0, 500, 2500]);
    expect(test.endedAt).toBe(2500);
    const result = samples(test);
    expect(result.map((s) => s.second)).toEqual([1, 2, 2.5]);
    expect(result.at(-1)).toMatchObject({ wpm: score(test).wpm, raw: score(test).rawWpm });
  });

  it('follows a Time test to its last second, counting only words finished', () => {
    // "one two thr" in the first second: two words done, a third started.
    let test = newTest({ kind: 'time', seconds: 15 }, ['one', 'two', 'three']);
    test = typeKeys(test, 'one two thr', [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    test = press(test, { type: 'tick', at: 15_000 });
    const result = samples(test);
    expect(result).toHaveLength(15);
    expect(result[0]).toEqual({ second: 1, wpm: 96, raw: 132 });
    expect(result.at(-1)).toEqual({ second: 15, wpm: 6, raw: 9 });
  });

  it('has no samples before a test has started, or in less than an instant', () => {
    expect(samples(wordsTest(['the']))).toEqual([]);
    expect(samples(typeKeys(wordsTest(['the']), 't'))).toEqual([]);
  });
});
