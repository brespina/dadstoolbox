// The words a typing test asks for: our own list of common English words, drawn at
// random. Pure: no page, so Vitest tests it with a seeded random source.

import type { Random } from '../../practice/random';

/** About 200 common English words, all lowercase. Our own list. */
export const commonWords: readonly string[] = `
  the of and to in is you that it he was for on are as with his they at be this have
  from or one had by word but not what all were we when your can said there use an
  each which she do how their if will up other about out many then them these so some
  her would make like him into time has look two more write go see number no way could
  people my than first water been call who oil its now find long down day did get come
  made may part over new sound take only little work know place year live me back give
  most very after thing our just name good sentence man think say great where help
  through much before line right too mean old any same tell boy follow came want show
  also around form three small set put end does another well large must big even such
  because turn here why ask went men read need land different home us move try kind
  hand picture again change off play spell air away animal house point page letter
  mother answer found study still learn should world high every near
`
  .trim()
  .split(/\s+/);

/** Contractions for Punctuation: an apostrophe is never a word on its own. */
export const contractions: readonly string[] = [
  "don't",
  "it's",
  "I'm",
  "we're",
  "can't",
  "isn't",
  "that's",
  "they're",
  "you're",
  "didn't",
  "won't",
  "I'll",
];

/** Which extras the words carry. Both off gives only lowercase letters. */
export interface WordOptions {
  /** Capitals after a full stop, commas, full stops, question marks, apostrophes and quotes. */
  punctuation?: boolean;
  /** Short numbers in place of some words. */
  numbers?: boolean;
}

// Chances per word.
const numberChance = 0.1;
const contractionChance = 0.05;
const quoteChance = 0.05;
const markChance = 0.18;

/** Marks that can end a word: mostly commas. */
const marks = [',', ',', ',', ',', '.', '.', '.', '?'] as const;

/** A number of 1 to 4 digits, with no leading zero. Always takes five random numbers. */
function numberWord(random: Random): string {
  const pick = random();
  const length = pick < 0.35 ? 1 : pick < 0.7 ? 2 : pick < 0.9 ? 3 : 4;
  let digits = '';
  for (let i = 0; i < 4; i++) {
    const draw = random();
    if (i >= length) continue;
    digits += i === 0 && length > 1 ? 1 + Math.floor(draw * 9) : Math.floor(draw * 10);
  }
  return digits;
}

/**
 * A stream of common words drawn with `random`: each call gives the next `count` words.
 * A word never follows itself, even across calls, so a Time test can ask for more.
 *
 * With Punctuation the stream remembers, between calls, that the next word starts a
 * sentence. A quote opened in a call is closed in the same call (within four words), so a
 * call never ends with a quote open. Every word takes the same random numbers whatever
 * is switched on.
 */
export function wordStream(
  random: Random,
  options: WordOptions = {},
): (count: number) => string[] {
  const { punctuation = false, numbers = false } = options;
  let previous: string | undefined;
  let capitalNext = true;
  return (count) => {
    const words: string[] = [];
    // The index of the word that closes the quote now open, and the quote mark to close it.
    let closeAt = -1;
    let closer = '';
    for (let i = 0; i < count; i++) {
      let base: string;
      do {
        base = commonWords[Math.floor(random() * commonWords.length)]!;
      } while (base === previous);
      previous = base;
      const numberRoll = random();
      const number = numberWord(random);
      const contractionRoll = random();
      const contraction = contractions[Math.floor(random() * contractions.length)]!;
      const quoteRoll = random();
      const quoteLength = Math.floor(random() * 4);
      const quoteKind = random();
      const markRoll = random();
      const mark = marks[Math.floor(random() * marks.length)]!;

      let word = base;
      // After a full stop the next word stays a word, so it can take its capital.
      if (numbers && numberRoll < numberChance && !(punctuation && capitalNext)) word = number;
      else if (punctuation && contractionRoll < contractionChance) word = contraction;
      if (!punctuation) {
        words.push(word);
        continue;
      }

      // The capital goes on before the quote does: "Hello, not Hello.
      if (capitalNext && /^[a-z]/.test(word)) word = word[0]!.toUpperCase() + word.slice(1);
      capitalNext = false;
      if (closeAt < 0 && i < count - 1 && quoteRoll < quoteChance) {
        closer = quoteKind < 0.8 ? '"' : "'";
        word = closer + word;
        closeAt = Math.min(i + quoteLength, count - 1);
      }
      if (markRoll < markChance) {
        word += mark;
        capitalNext = mark !== ',';
      }
      // The closing quote comes after the mark: `word,"`.
      if (closeAt === i) {
        word += closer;
        closeAt = -1;
      }
      words.push(word);
    }
    return words;
  };
}
