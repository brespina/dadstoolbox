// The Lessons of Vim practice, as data. Each Lesson adds a few motions and allows every
// earlier Lesson's motions too, and has its own hand-written texts for its Drills.
//
// Rules for a Lesson's texts (checked in round.test.ts): no tabs, no spaces at the end of
// a line, at most 32 characters a line (to fit a phone), and no empty first or last line.
// Every character must be reachable from the first one within the search's bound.
import { motions, type Motions, type Text } from './vim';

export interface Lesson {
  /** The motions this Lesson adds, as keys of the engine's `motions`. */
  adds: readonly (keyof typeof motions)[];
  /** The texts its Drills are drawn from. */
  texts: readonly Text[];
}

export const lessons: readonly Lesson[] = [
  {
    adds: ['h', 'j', 'k', 'l'],
    texts: [
      [
        'The quick brown fox',
        'jumps over the lazy dog.',
        'Pack my box with five',
        'dozen liquor jugs.',
      ],
      ['let total = 0;', 'for (const n of list) {', '  total += n;', '}', 'return total;'],
      [
        'h moves left, l moves right.',
        'j goes down a line, k goes up.',
        '',
        'Type 3j to go down three.',
      ],
      ['Tea for two,', 'and two for tea.', 'Me for you,', 'and you for me.'],
    ],
  },
  {
    adds: ['w', 'b', 'e', 'W', 'B', 'E'],
    texts: [
      [
        'const name = user.first_name;',
        "const mail = user?.email ?? '';",
        'if (!name) return null;',
      ],
      [
        'Words, words, words: that is',
        'what w, b and e are for. A',
        'WORD skips punctuation, so W',
        'jumps "e.g." in one go.',
      ],
      [
        'import { readFile } from "fs";',
        '',
        'const text = readFile(path);',
        'console.log(text.length);',
      ],
      ['The rain in Spain stays', 'mainly in the plain; the', 'hills (and hollows) stay dry.'],
    ],
  },
  {
    adds: ['0', '^', '$'],
    texts: [
      [
        'function greet(name) {',
        '  if (name) {',
        "    return 'Hi, ' + name;",
        '  }',
        "  return 'Hello!';",
        '}',
      ],
      [
        '  Lines that start with spaces',
        '    are where ^ helps most,',
        '  and $ goes to the end.',
        '0 is the very first column.',
      ],
      ['<ul>', '  <li>Milk</li>', '  <li>Bread and butter</li>', '  <li>Eggs</li>', '</ul>'],
    ],
  },
];

/** The motions allowed in the Lesson at `index`: its own and every earlier Lesson's. */
export function lessonMotions(index: number): Motions {
  const keys = lessons.slice(0, index + 1).flatMap((lesson) => lesson.adds);
  return Object.fromEntries(keys.map((key) => [key, motions[key]]));
}
