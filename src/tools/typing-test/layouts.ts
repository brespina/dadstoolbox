// Layouts: which character each physical key types. A key is named by the browser's
// `KeyboardEvent.code`, which names the key's place on a US QWERTY board and does not
// change with the computer's own keyboard setting. A Layout turns that place, and
// whether Shift is down, into the character to score.

export const layouts = ['own', 'colemak', 'dvorak', 'programmer-dvorak'] as const;
export type Layout = (typeof layouts)[number];

/** The four rows of a US board, as codes, left to right. The space bar is apart. */
export const keyRows: readonly (readonly string[])[] = [
  [
    'Backquote',
    ...'1234567890'.split('').map((digit) => `Digit${digit}`),
    'Minus',
    'Equal',
  ],
  [
    ...'QWERTYUIOP'.split('').map((letter) => `Key${letter}`),
    'BracketLeft',
    'BracketRight',
    'Backslash',
  ],
  [...'ASDFGHJKL'.split('').map((letter) => `Key${letter}`), 'Semicolon', 'Quote'],
  [...'ZXCVBNM'.split('').map((letter) => `Key${letter}`), 'Comma', 'Period', 'Slash'],
];

/** What a Layout types on each row of keys, without Shift and with it, left to right. */
type Rows = readonly [
  readonly [string, string],
  readonly [string, string],
  readonly [string, string],
  readonly [string, string],
];

const colemak: Rows = [
  ['`1234567890-=', '~!@#$%^&*()_+'],
  ['qwfpgjluy;[]\\', 'QWFPGJLUY:{}|'],
  ["arstdhneio'", 'ARSTDHNEIO"'],
  ['zxcvbkm,./', 'ZXCVBKM<>?'],
];

const dvorak: Rows = [
  ['`1234567890[]', '~!@#$%^&*(){}'],
  ["',.pyfgcrl/=\\", '"<>PYFGCRL?+|'],
  ['aoeuidhtns-', 'AOEUIDHTNS_'],
  [';qjkxbmwvz', ':QJKXBMWVZ'],
];

// Kaufmann's Programmer Dvorak: symbols on the number row, digits with Shift in the
// odd-then-even order 7 5 3 1 9 0 2 4 6 8.
const programmerDvorak: Rows = [
  ['$&[{}(=*)+]!#', '~%7531902468`'],
  [";,.pyfgcrl/@\\", ':<>PYFGCRL?^|'],
  ['aoeuidhtns-', 'AOEUIDHTNS_'],
  ["'qjkxbmwvz", '"QJKXBMWVZ'],
];

const maps: Record<Exclude<Layout, 'own'>, Rows> = {
  colemak,
  dvorak,
  'programmer-dvorak': programmerDvorak,
};

/** Every code with its [without Shift, with Shift] characters, per Layout. */
function build(rows: Rows): Map<string, readonly [string, string]> {
  const keys = new Map<string, readonly [string, string]>();
  rows.forEach(([plain, shifted], row) => {
    [...plain].forEach((char, i) => keys.set(keyRows[row]![i]!, [char, [...shifted][i]!]));
  });
  return keys;
}

const keysOf = new Map(
  (Object.keys(maps) as Exclude<Layout, 'own'>[]).map((layout) => [layout, build(maps[layout])]),
);

/** The character a key types in a Layout, or null when the Layout leaves the key alone. */
export function resolve(layout: Layout, code: string, shift: boolean): string | null {
  if (layout === 'own') return null;
  const chars = keysOf.get(layout)!.get(code);
  return chars ? chars[shift ? 1 : 0] : null;
}

/** The key, and whether Shift goes with it, that types a character in a Layout. */
export function locate(layout: Layout, char: string): { code: string; shift: boolean } | null {
  if (layout === 'own') return null;
  if (char === ' ') return { code: 'Space', shift: false };
  for (const [code, [plain, shifted]] of keysOf.get(layout)!) {
    if (char === plain) return { code, shift: false };
    if (char === shifted) return { code, shift: true };
  }
  return null;
}
