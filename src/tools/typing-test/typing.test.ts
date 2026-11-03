import { describe, expect, it } from 'vitest';
import {
  addWords,
  newTest,
  press,
  score,
  status,
  wordLetters,
  type KeyPress,
  type TypingTest,
} from './typing';

/** Presses one key a second from `start`: a character, or ⌫ for Backspace and ⌦ to clear the word. */
function typeKeys(test: TypingTest, keys: string, start = 0): TypingTest {
  return [...keys].reduce((current, key, i) => {
    const at = start + i * 1000;
    const action: KeyPress =
      key === '⌫'
        ? { type: 'backspace', at }
        : key === '⌦'
          ? { type: 'clearWord', at }
          : { type: 'char', char: key, at };
    return press(current, action);
  }, test);
}

const wordsTest = (words: string[]) => newTest({ kind: 'words', count: words.length }, words);

describe('a Words test', () => {
  it('scores a test typed without mistakes', () => {
    // 7 key presses over 6 seconds: "the" + space + "cat" is 7 characters, so 14 wpm.
    const test = typeKeys(wordsTest(['the', 'cat']), 'the cat');
    expect(status(test)).toBe('done');
    expect(score(test)).toEqual({
      wpm: 14,
      rawWpm: 14,
      accuracy: 100,
      seconds: 6,
      characters: { correct: 6, wrong: 0, extra: 0, missed: 0 },
    });
  });
});

describe('mistakes', () => {
  it('counts only words typed right toward wpm, and every key toward raw wpm', () => {
    // "thx" is wrong, so only "cat" (3 characters) counts: 6 wpm over 6 seconds.
    const test = typeKeys(wordsTest(['the', 'cat']), 'thx cat');
    expect(score(test)).toMatchObject({
      wpm: 6,
      rawWpm: 14,
      // The x and the space after the wrong word are the 2 wrong presses out of 7.
      accuracy: 71,
      characters: { correct: 5, wrong: 1, extra: 0, missed: 0 },
    });
  });

  it('counts extra letters past the end of a word', () => {
    const test = typeKeys(wordsTest(['to', 'be']), 'tooo be');
    expect(score(test)).toMatchObject({
      wpm: 4,
      accuracy: 57,
      characters: { correct: 4, wrong: 0, extra: 2, missed: 0 },
    });
  });

  it('shows at most 10 extra letters, and ignores the rest', () => {
    const test = typeKeys(wordsTest(['to', 'be']), `to${'x'.repeat(12)} be`);
    expect(test.typed[0]).toBe(`to${'x'.repeat(10)}`);
    expect(score(test).characters.extra).toBe(10);
    // The 2 ignored presses are not counted: 2 + 10 + space + 2 = 15 presses.
    expect(test.presses).toHaveLength(15);
  });

  it('counts the letters left untyped in a word moved on from as missed', () => {
    // Only "be" (2 characters) counts, over 4 seconds: 6 wpm.
    const test = typeKeys(wordsTest(['these', 'be']), 'th be');
    expect(score(test)).toMatchObject({
      wpm: 6,
      characters: { correct: 4, wrong: 0, extra: 0, missed: 3 },
    });
  });
});

describe('fixing a word', () => {
  it('Backspace removes the last letter, but the wrong press still counts', () => {
    // c, x (wrong), Backspace, a, t: 4 presses over 4 seconds.
    const test = typeKeys(wordsTest(['cat']), 'cx⌫at');
    expect(status(test)).toBe('done');
    expect(score(test)).toEqual({
      wpm: 9,
      rawWpm: 12,
      accuracy: 75,
      seconds: 4,
      characters: { correct: 3, wrong: 0, extra: 0, missed: 0 },
    });
  });

  it('Backspace stays within the current word', () => {
    const test = typeKeys(wordsTest(['to', 'be']), 'to ⌫be');
    expect(test.typed).toEqual(['to', 'be']);
    expect(score(test).characters).toEqual({ correct: 4, wrong: 0, extra: 0, missed: 0 });
  });

  it('clearing the word removes it all', () => {
    const test = typeKeys(wordsTest(['cat']), 'xyz⌦cat');
    expect(status(test)).toBe('done');
    expect(score(test)).toMatchObject({
      accuracy: 50,
      characters: { correct: 3, wrong: 0, extra: 0, missed: 0 },
    });
  });
});

describe('moving on', () => {
  it('a space before anything is typed does nothing', () => {
    const test = typeKeys(wordsTest(['to', 'be']), '  ');
    expect(status(test)).toBe('waiting');
    expect(test.typed).toEqual(['']);
  });

  it('a space on the last word ends a Words test, even with a mistake', () => {
    const test = typeKeys(wordsTest(['cat']), 'cot ');
    expect(status(test)).toBe('done');
    expect(score(test)).toMatchObject({
      wpm: 0,
      characters: { correct: 2, wrong: 1, extra: 0, missed: 0 },
    });
  });
});

describe('wordLetters', () => {
  it('marks each letter right, wrong (showing the letter wanted), extra or not typed yet', () => {
    expect(wordLetters('cat', 'cu')).toEqual([
      { char: 'c', kind: 'right' },
      { char: 'a', kind: 'wrong' },
      { char: 't', kind: 'untyped' },
    ]);
    expect(wordLetters('to', 'tox')).toEqual([
      { char: 't', kind: 'right' },
      { char: 'o', kind: 'right' },
      { char: 'x', kind: 'extra' },
    ]);
  });
});

describe('a Time test', () => {
  const timeTest = () => newTest({ kind: 'time', seconds: 15 }, ['the', 'cat', 'sat']);

  it('waits for the first key press, then lasts its seconds from there', () => {
    let test = press(timeTest(), { type: 'tick', at: 3000 });
    expect(status(test)).toBe('waiting');
    test = typeKeys(test, 'the ca', 5000);
    expect(status(test)).toBe('typing');
    expect(status(press(test, { type: 'tick', at: 19_999 }))).toBe('typing');
    test = press(test, { type: 'tick', at: 20_000 });
    expect(status(test)).toBe('done');
    // "the " is 4 characters in 15 seconds: 3.2 wpm, shown as 3. The half-typed
    // "ca" counts its right letters but misses none.
    expect(score(test)).toMatchObject({
      wpm: 3,
      seconds: 15,
      characters: { correct: 5, wrong: 0, extra: 0, missed: 0 },
    });
  });

  it('ignores keys pressed after the time is up', () => {
    const test = typeKeys(timeTest(), 'the ca', 0);
    const late = press(test, { type: 'char', char: 't', at: 15_000 });
    expect(status(late)).toBe('done');
    expect(late.typed).toEqual(['the', 'ca']);
    expect(score(late).seconds).toBe(15);
  });

  it('takes more words as it goes', () => {
    const test = typeKeys(addWords(timeTest(), ['dog']), 'the cat sat dog');
    expect(status(test)).toBe('typing');
    expect(score(test).characters.correct).toBe(12);
  });
});
