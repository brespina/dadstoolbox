import { describe, expect, it } from 'vitest';
import { layouts, locate, resolve, type Layout } from './layouts';

// The keys of a US QWERTY board, as the browser names them, in the order that
// reading the letter rows left to right gives.
const letterKeys = (letters: string) => letters.split('').map((letter) => `Key${letter}`);
const qwertyLetters = [
  ...letterKeys('QWERTYUIOP'),
  ...letterKeys('ASDFGHJKL'),
  'Semicolon',
  ...letterKeys('ZXCVBNM'),
  'Comma',
  'Period',
  'Slash',
];
const numberRow = [
  'Backquote',
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit) => `Digit${digit}`),
  'Minus',
  'Equal',
];
const otherKeys = ['BracketLeft', 'BracketRight', 'Backslash', 'Quote'];

/** What a layout types when the given physical keys are pressed, in order. */
const typed = (layout: Layout, codes: string[], shift = false) =>
  codes.map((code) => resolve(layout, code, shift)).join('');

describe('resolve', () => {
  it('turns the keys that spell qwerty into qwfpgj in Colemak', () => {
    expect(typed('colemak', qwertyLetters.slice(0, 6))).toBe('qwfpgj');
  });

  it("turns the keys that spell qwerty into ',.pyf in Dvorak", () => {
    expect(typed('dvorak', qwertyLetters.slice(0, 6))).toBe("',.pyf");
  });

  it('gives the whole Colemak letter block', () => {
    expect(typed('colemak', qwertyLetters)).toBe('qwfpgjluy;arstdhneiozxcvbkm,./');
  });

  it('gives the whole Dvorak letter block', () => {
    expect(typed('dvorak', qwertyLetters)).toBe("',.pyfgcrlaoeuidhtns;qjkxbmwvz");
  });

  it('types capitals and shifted symbols with Shift', () => {
    expect(typed('colemak', qwertyLetters.slice(0, 6), true)).toBe('QWFPGJ');
    expect(resolve('colemak', 'Semicolon', true)).toBe('O');
    expect(resolve('colemak', 'KeyP', true)).toBe(':');
    expect(resolve('dvorak', 'KeyQ', true)).toBe('"');
    expect(resolve('dvorak', 'Minus', true)).toBe('{');
  });

  it("gives Programmer Dvorak's number row unshifted: symbols", () => {
    expect(typed('programmer-dvorak', numberRow)).toBe('$&[{}(=*)+]!#');
  });

  it("gives Programmer Dvorak's number row shifted: digits in the odd-even order", () => {
    expect(typed('programmer-dvorak', numberRow, true)).toBe('~%7531902468`');
  });

  it("gives Programmer Dvorak's letter rows", () => {
    expect(typed('programmer-dvorak', qwertyLetters)).toBe(";,.pyfgcrlaoeuidhtns'qjkxbmwvz");
    expect(resolve('programmer-dvorak', 'BracketRight', false)).toBe('@');
    expect(resolve('programmer-dvorak', 'BracketRight', true)).toBe('^');
  });

  it('keeps digits on the number row in Colemak and Dvorak', () => {
    expect(typed('colemak', numberRow)).toBe('`1234567890-=');
    expect(typed('dvorak', numberRow)).toBe('`1234567890[]');
  });

  it('gives nothing for keys the layout does not map', () => {
    expect(resolve('colemak', 'Space', false)).toBeNull();
    expect(resolve('colemak', 'Enter', false)).toBeNull();
    expect(resolve('dvorak', 'F5', false)).toBeNull();
  });

  it('gives nothing for "as my keyboard types", which uses the key the browser names', () => {
    expect(resolve('own', 'KeyQ', false)).toBeNull();
  });
});

describe('locate', () => {
  it('finds the key and Shift for a character', () => {
    expect(locate('colemak', 'f')).toEqual({ code: 'KeyE', shift: false });
    expect(locate('colemak', 'F')).toEqual({ code: 'KeyE', shift: true });
    expect(locate('programmer-dvorak', '7')).toEqual({ code: 'Digit2', shift: true });
    expect(locate('programmer-dvorak', '&')).toEqual({ code: 'Digit1', shift: false });
  });

  it('finds the space bar', () => {
    expect(locate('dvorak', ' ')).toEqual({ code: 'Space', shift: false });
  });

  it('finds nothing for a character the layout cannot type', () => {
    expect(locate('colemak', 'é')).toBeNull();
    expect(locate('own', 'a')).toBeNull();
  });

  it('finds every character on exactly the key and Shift that types it', () => {
    for (const layout of layouts) {
      if (layout === 'own') continue;
      for (const code of [...numberRow, ...qwertyLetters, ...otherKeys]) {
        for (const shift of [false, true]) {
          const char = resolve(layout, code, shift);
          expect(char, `${layout} ${code}`).not.toBeNull();
          expect(locate(layout, char!), `${layout} ${char}`).toEqual({ code, shift });
        }
      }
    }
  });
});
