import { describe, expect, it } from 'vitest';
import { bannedWordsIn, allStrings } from './wording';
import { text } from './text';

describe('bannedWordsIn', () => {
  it.each([
    ['Upload your photo', 'upload'],
    ['Tap to download', 'download'],
    ['Convert to JPG', 'convert'],
    ['A free converter', 'converter'],
    ['Removes metadata', 'metadata'],
    ['Strips EXIF', 'exif'],
    ['Encoding your video', 'encod'],
    ['Nothing goes to a server', 'server'],
    ['Runs client-side', 'client-side'],
    ['Built on WebAssembly', 'webassembly'],
    ['Clear your cache', 'cache'],
    ['That file is invalid', 'invalid'],
    ['Error code 42', 'error code'],
  ])('flags %j', (sentence, word) => {
    expect(bannedWordsIn(sentence)).toContain(word);
  });

  it('allows HEIC inside its gloss', () => {
    expect(bannedWordsIn('Change an iPhone photo (HEIC) to JPG')).toEqual([]);
  });

  it('flags HEIC on its own', () => {
    expect(bannedWordsIn('Change a HEIC to JPG')).toContain('heic');
  });

  it('passes plain everyday words', () => {
    expect(bannedWordsIn('Choose photos, then tap Save.')).toEqual([]);
  });
});

describe('allStrings', () => {
  it('collects strings from nested objects and arrays', () => {
    expect(allStrings({ a: 'one', b: { c: ['two', { d: 'three' }] }, n: 4 })).toEqual([
      'one',
      'two',
      'three',
    ]);
  });
});

describe('shared text', () => {
  it.each(allStrings(text))('%j uses only plain words', (line) => {
    expect(bannedWordsIn(line)).toEqual([]);
  });
});
