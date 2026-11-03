// A typing test's state, changed one key press at a time, and its score. Pure: no page.
// The page turns each key event into a KeyPress with the character already worked out
// (so a Layout can map the physical key to its character before it gets here).

/** How long a test lasts: a number of seconds, or a number of words. */
export type TestLength = { kind: 'time'; seconds: number } | { kind: 'words'; count: number };

/**
 * One key press, at a time in milliseconds (any clock, such as performance.now()):
 * - char: a typed character; a space moves on to the next word
 * - backspace: removes the last character of the current word
 * - clearWord: clears the current word (Ctrl+Backspace or Alt+Backspace)
 * - tick: no key, just the time passing, so a Time test can end
 */
export type KeyPress =
  | { type: 'char'; char: string; at: number }
  | { type: 'backspace'; at: number }
  | { type: 'clearWord'; at: number }
  | { type: 'tick'; at: number };

/** At most this many extra characters show past the end of a word; more are ignored. */
export const maxExtra = 10;

export interface TypingTest {
  readonly length: TestLength;
  /** The words to type. A Time test gets more with `addWords` as it goes. */
  readonly words: readonly string[];
  /** What was typed for each word so far; the last one is the current word. */
  readonly typed: readonly string[];
  /** When the first key was pressed, and when the test ended. */
  readonly startedAt?: number;
  readonly endedAt?: number;
  /**
   * Every character key press (spaces too) and whether it was right, in order. With
   * `wordEnds`, enough to work out the speed at any moment of the test.
   */
  readonly presses: readonly { at: number; correct: boolean }[];
  /** When each finished word was finished, by its index. */
  readonly wordEnds: readonly number[];
}

export function newTest(length: TestLength, words: readonly string[]): TypingTest {
  return { length, words, typed: [''], presses: [], wordEnds: [] };
}

/** More words for a Time test, added to the end. */
export function addWords(test: TypingTest, words: readonly string[]): TypingTest {
  return { ...test, words: [...test.words, ...words] };
}

export function status(test: TypingTest): 'waiting' | 'typing' | 'done' {
  if (test.endedAt !== undefined) return 'done';
  return test.startedAt === undefined ? 'waiting' : 'typing';
}

/** The test after one key press. A press after the test ends changes nothing. */
export function press(test: TypingTest, key: KeyPress): TypingTest {
  if (status(test) === 'done') return test;
  if (test.startedAt !== undefined && test.length.kind === 'time') {
    const end = test.startedAt + test.length.seconds * 1000;
    if (key.at >= end) return { ...test, endedAt: end };
  }
  if (key.type === 'tick') return test;

  const index = test.typed.length - 1;
  const target = test.words[index] ?? '';
  const current = test.typed[index]!;
  const withCurrent = (word: string): TypingTest => ({
    ...test,
    typed: [...test.typed.slice(0, index), word],
  });

  if (key.type === 'backspace') return withCurrent(current.slice(0, -1));
  if (key.type === 'clearWord') return withCurrent('');

  // The test starts at the first key that types something.
  const started = (next: TypingTest): TypingTest =>
    next.startedAt === undefined ? { ...next, startedAt: key.at } : next;
  const pressed = { at: key.at, correct: false };

  if (key.char === ' ') {
    // A space before anything is typed does nothing, so a word can't be skipped by mistake.
    if (current === '') return test;
    pressed.correct = current === target;
    const next = started({
      ...test,
      typed: [...test.typed, ''],
      presses: [...test.presses, pressed],
      wordEnds: [...test.wordEnds, key.at],
    });
    const last = index === test.words.length - 1;
    return last ? { ...next, typed: test.typed, endedAt: key.at } : next;
  }

  if (current.length >= target.length + maxExtra) return test;
  pressed.correct = key.char === target[current.length];
  const word = current + key.char;
  const next = started({ ...withCurrent(word), presses: [...test.presses, pressed] });
  // A Words test ends as soon as the last word is typed right, with no space needed.
  const finished =
    test.length.kind === 'words' && index === test.words.length - 1 && word === target;
  return finished ? { ...next, wordEnds: [...next.wordEnds, key.at], endedAt: key.at } : next;
}

/** How a letter shows. A wrong letter shows the letter wanted; an extra one, the one typed. */
export type LetterKind = 'right' | 'wrong' | 'extra' | 'untyped';

/** The letters to show for a word, given what was typed for it. */
export function wordLetters(target: string, typed: string): { char: string; kind: LetterKind }[] {
  const letters = [...target].map((char, i) => ({
    char,
    kind: (i >= typed.length ? 'untyped' : typed[i] === char ? 'right' : 'wrong') as LetterKind,
  }));
  const extras = [...typed.slice(target.length)].map((char) => ({
    char,
    kind: 'extra' as LetterKind,
  }));
  return [...letters, ...extras];
}

export interface Score {
  /** Characters of the words typed right, with the spaces after them, per minute, as words of 5. */
  wpm: number;
  /** Every character key pressed, per minute, as words of 5. */
  rawWpm: number;
  /** Right key presses out of all key presses, as a whole percent. */
  accuracy: number;
  seconds: number;
  /**
   * Letters typed right and wrong, extra letters past a word's end, and letters missed
   * in words moved on from.
   */
  characters: { correct: number; wrong: number; extra: number; missed: number };
}

/**
 * Characters of the words typed right, with the spaces after them, finished by `until`
 * milliseconds (any time, by default): what counts toward wpm.
 */
export function rightWordCharacters(test: TypingTest, until = Infinity): number {
  let total = 0;
  test.typed.forEach((typed, i) => {
    const target = test.words[i] ?? '';
    const finishedAt = test.wordEnds[i];
    if (finishedAt === undefined || finishedAt > until || typed !== target) return;
    // The space after it counts too, unless it ended the test.
    const space = finishedAt === test.endedAt && test.typed.length === i + 1 ? 0 : 1;
    total += target.length + space;
  });
  return total;
}

export function score(test: TypingTest): Score {
  const startedAt = test.startedAt ?? 0;
  const endedAt = test.endedAt ?? test.presses.at(-1)?.at ?? startedAt;
  const seconds = (endedAt - startedAt) / 1000;
  const perMinute = (characters: number) =>
    seconds > 0 ? Math.round(characters / 5 / (seconds / 60)) : 0;

  const characters = { correct: 0, wrong: 0, extra: 0, missed: 0 };
  test.typed.forEach((typed, i) => {
    const target = test.words[i] ?? '';
    const finished = i < test.wordEnds.length;
    for (let p = 0; p < typed.length; p++) {
      if (p >= target.length) characters.extra++;
      else if (typed[p] === target[p]) characters.correct++;
      else characters.wrong++;
    }
    if (finished) characters.missed += Math.max(0, target.length - typed.length);
  });

  const right = test.presses.filter((p) => p.correct).length;
  return {
    wpm: perMinute(rightWordCharacters(test)),
    rawWpm: perMinute(test.presses.length),
    accuracy: test.presses.length > 0 ? Math.round((right / test.presses.length) * 100) : 0,
    seconds,
    characters,
  };
}
