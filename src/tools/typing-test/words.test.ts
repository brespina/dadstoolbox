import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../practice/random';
import { commonWords, contractions, wordStream } from './words';

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

describe('wordStream with Punctuation', () => {
  const words = wordStream(seededRandom(11), { punctuation: true })(600);
  const sentenceEnd = /[.?]["']?$/;

  /** Whether every double quote opened in `list` is closed in it, with none nested. */
  function quotesBalance(list: string[]): boolean {
    let open = false;
    for (const word of list) {
      if (word.startsWith('"')) {
        if (open) return false;
        open = true;
      }
      if (word.endsWith('"')) {
        if (!open) return false;
        open = false;
      }
    }
    return !open;
  }

  it('gives the same words for the same seed, and different words for another', () => {
    expect(wordStream(seededRandom(11), { punctuation: true })(600)).toEqual(words);
    expect(wordStream(seededRandom(12), { punctuation: true })(600)).not.toEqual(words);
  });

  it('gives exactly as many words as asked, none empty', () => {
    expect(words).toHaveLength(600);
    for (const word of words) expect(word).toMatch(/^["']?[A-Za-z][A-Za-z']*[,.?]?["']?$/);
  });

  it('starts with a capital, and so does every word after a full stop or question mark', () => {
    expect(words[0]).toMatch(/^["']?[A-Z]/);
    words.slice(1).forEach((word, i) => {
      if (sentenceEnd.test(words[i]!)) expect(word).toMatch(/^["']?[A-Z]/);
    });
  });

  it('has a capital only at the start of a sentence, or in I', () => {
    words.forEach((word, i) => {
      const startsSentence = i === 0 || sentenceEnd.test(words[i - 1]!);
      if (!startsSentence && !/^["']?I/.test(word)) expect(word).toMatch(/^["']?[a-z]/);
    });
  });

  it('uses commas, full stops, question marks, apostrophes and quotes', () => {
    const text = words.join(' ');
    for (const mark of [',', '.', '?', '"']) expect(text).toContain(mark);
    const bare = (word: string) => word.replace(/^["']|[,.?"']+$/g, '');
    expect(words.some((word) => contractions.includes(bare(word)))).toBe(true);
  });

  it('closes every double quote it opens, never nested, never left open', () => {
    expect(quotesBalance(words)).toBe(true);
  });

  it('closes every quote within one ask, however short, and carries sentences across asks', () => {
    const next = wordStream(seededRandom(5), { punctuation: true });
    const all: string[] = [];
    for (let ask = 0; ask < 80; ask++) {
      const batch = next(1 + (ask % 7));
      expect(quotesBalance(batch)).toBe(true);
      all.push(...batch);
    }
    all.slice(1).forEach((word, i) => {
      if (sentenceEnd.test(all[i]!)) expect(word).toMatch(/^["']?[A-Z]/);
    });
  });
});

describe('wordStream with Numbers', () => {
  const words = wordStream(seededRandom(21), { numbers: true })(500);

  it('mixes in numbers of one to four digits with no leading zero, and nothing else', () => {
    const numbers = words.filter((word) => /\d/.test(word));
    expect(numbers.length).toBeGreaterThan(20);
    for (const number of numbers) expect(number).toMatch(/^([0-9]|[1-9][0-9]{1,3})$/);
    for (const word of words) expect(word).toMatch(/^([a-z]+|\d+)$/);
  });

  it('uses numbers of every length', () => {
    const lengths = new Set(words.filter((w) => /^\d+$/.test(w)).map((w) => w.length));
    expect([...lengths].sort()).toEqual([1, 2, 3, 4]);
  });

  it('is repeatable for a seed and keeps the count', () => {
    expect(wordStream(seededRandom(21), { numbers: true })(500)).toEqual(words);
    expect(words).toHaveLength(500);
  });
});

describe('wordStream with Punctuation and Numbers together', () => {
  const words = wordStream(seededRandom(33), { punctuation: true, numbers: true })(600);

  it('has numbers and punctuation, and the count asked for', () => {
    expect(words).toHaveLength(600);
    expect(words.some((w) => /^["']?\d{1,4}[,.?]?["']?$/.test(w))).toBe(true);
    expect(words.join(' ')).toMatch(/[.?]"? "?[A-Z]/);
  });

  it('still gives a capital to the word after a full stop, never a number', () => {
    words.slice(1).forEach((word, i) => {
      if (/[.?]["']?$/.test(words[i]!)) expect(word).toMatch(/^["']?[A-Z]/);
    });
  });

  it('has no empty words and no leading zeros', () => {
    for (const word of words) {
      expect(word).not.toBe('');
      expect(word).not.toMatch(/(^|\D)0\d/);
    }
  });
});

describe('wordStream with both switches off', () => {
  it('gives only lowercase letters', () => {
    const words = wordStream(seededRandom(9), { punctuation: false, numbers: false })(500);
    for (const word of words) expect(word).toMatch(/^[a-z]+$/);
  });
});

describe('commonWords', () => {
  it('holds about 200 different lowercase words', () => {
    expect(commonWords.length).toBeGreaterThanOrEqual(190);
    expect(new Set(commonWords).size).toBe(commonWords.length);
    for (const word of commonWords) expect(word).toMatch(/^[a-z]+$/);
  });
});
