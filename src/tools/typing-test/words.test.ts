import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../practice/random';
import { commonWords, wordStream } from './words';

describe('wordStream', () => {
  it('gives the same words for the same seed', () => {
    const first = wordStream(seededRandom(42))(50);
    const second = wordStream(seededRandom(42))(50);
    expect(first).toEqual(second);
  });

  it('gives different words for a different seed', () => {
    expect(wordStream(seededRandom(1))(50)).not.toEqual(wordStream(seededRandom(2))(50));
  });

  it('gives as many words as asked, each from the common words', () => {
    const words = wordStream(seededRandom(7))(300);
    expect(words).toHaveLength(300);
    for (const word of words) expect(commonWords).toContain(word);
  });

  it('never gives the same word twice in a row, even across asks', () => {
    const next = wordStream(seededRandom(3));
    const words = [...next(200), ...next(200), ...next(1), ...next(1)];
    words.slice(1).forEach((word, i) => expect(word).not.toBe(words[i]));
  });
});

describe('commonWords', () => {
  it('holds about 200 different lowercase words', () => {
    expect(commonWords.length).toBeGreaterThanOrEqual(190);
    expect(new Set(commonWords).size).toBe(commonWords.length);
    for (const word of commonWords) expect(word).toMatch(/^[a-z]+$/);
  });
});
