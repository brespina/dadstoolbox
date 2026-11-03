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

/**
 * Options for the words. Empty for now: the Punctuation and Numbers switches (#90) are
 * added here.
 */
export type WordOptions = Record<never, never>;

/**
 * A stream of common words drawn with `random`: each call gives the next `count` words.
 * A word never follows itself, even across calls, so a Time test can ask for more.
 */
export function wordStream(
  random: Random,
  _options: WordOptions = {},
): (count: number) => string[] {
  let previous: string | undefined;
  return (count) => {
    const words: string[] = [];
    while (words.length < count) {
      const word = commonWords[Math.floor(random() * commonWords.length)]!;
      if (word === previous) continue;
      words.push(word);
      previous = word;
    }
    return words;
  };
}
