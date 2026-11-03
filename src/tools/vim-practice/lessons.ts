// The Lessons of Vim practice, as data. Each Lesson adds a few motions and allows every
// earlier Lesson's motions too, and has its own hand-written texts for its Drills.
//
// Rules for a Lesson's texts (checked in round.test.ts): plain ASCII (the engine counts
// characters as code units) with no tabs, no spaces at the end of a line, at most 32
// characters a line (to fit a phone), and no empty first or last line.
// Every character must be reachable from the first one within the search's bound.
import { tool } from './declaration';
import { motions, type Motions, type Text } from './vim';

export interface Lesson {
  /** The motions this Lesson adds, as keys of the engine's `motions`. */
  adds: readonly (keyof typeof motions)[];
  /** The name on its radio button, when the motions it adds aren't a good one. */
  label?: string;
  /** The texts its Drills are drawn from. */
  texts: readonly Text[];
}

/** The name on a Lesson's radio button: its `label`, else the motions it adds. */
export function lessonLabel(lesson: Lesson): string {
  return lesson.label ?? lesson.adds.join(' ');
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
  {
    // Lines with repeated commas, quotes, dashes and slashes, so ; and , have work to do.
    adds: ['f', 'F', 't', 'T', ';', ','],
    texts: [
      [
        'name,age,city,country,zip',
        'Ann,34,Oslo,Norway,0150',
        'Bo,27,Lima,Peru,15001',
        'Cy,41,Kyiv,Ukraine,01001',
      ],
      ['print(a, b, c, d);', 'draw(x1, y1, x2, y2);', 'move(left, right, up, down);'],
      [
        'She said "go", he said "stop".',
        'Then: one, two, three, four.',
        'a-b-c-d, e-f-g-h, i-j-k-l',
      ],
      [
        '/home/user/docs/notes/todo.txt',
        'https://dad.com/a/b/c?x=1&y=2',
        'key=value;other=thing;last=one',
      ],
    ],
  },
  {
    // Taller texts, so jumping to a line is worth it.
    adds: ['gg', 'G'],
    texts: [
      [
        'Monday: laundry',
        'Tuesday: groceries',
        'Wednesday: call Mum',
        'Thursday: dentist',
        'Friday: pay the rent',
        'Saturday: mow the lawn',
        'Sunday: rest',
        'Monday: laundry again',
        'Tuesday: return books',
      ],
      [
        'function total(items) {',
        '  let sum = 0;',
        '  for (const item of items) {',
        '    sum += item.price;',
        '  }',
        '  return sum;',
        '}',
        '',
        'const list = [3, 5, 8];',
        'console.log(total(list));',
      ],
      [
        'Line one is first.',
        'Line two is next.',
        'Line three is here.',
        'Line four is half way.',
        'Line five is past it.',
        'Line six keeps going.',
        'Line seven is nearly done.',
        'Line eight is one more.',
        'Line nine is the last but one.',
        'Line ten is the end.',
      ],
    ],
  },
  {
    // Paragraphs split by empty lines (some by two) for { and }, and brackets for %.
    // No quotes, backslashes, # or comments: Vim's % treats those specially.
    adds: ['{', '}', '%'],
    texts: [
      [
        'Eggs, milk and flour.',
        'Mix them well (not too long).',
        '',
        'Pour the batter in.',
        'Wait for the edges',
        'to turn brown.',
        '',
        '',
        'Flip it over once.',
        'Serve it hot.',
        '',
        'Wash up (then rest).',
      ],
      [
        'function area(w, h) {',
        '  return w * h;',
        '}',
        '',
        'function double(n) {',
        '  return (n + n);',
        '}',
        '',
        'console.log(area(2, double(4)));',
      ],
      [
        'total = (price * (n + 1)) / 2;',
        'list = [first, [second, third]];',
        'item = {a: [1, 2], b: (3 + 4)};',
        '',
        'if (x > (y + 1)) {',
        '  run(a, (b + c));',
        '}',
      ],
      [
        'const config = {',
        '  size: [10, 20],',
        '  scale: (1 + 2) * 3,',
        '};',
        '',
        '',
        'const sum = (a, b) => {',
        '  return a + b;',
        '};',
      ],
    ],
  },
  {
    // Every motion, on longer texts that mix prose and code.
    adds: [],
    label: tool.notes.mixed,
    texts: [
      [
        'Shopping list (for Saturday)',
        'eggs, milk, butter, flour',
        '',
        'Chores [do before noon]',
        'sweep the porch',
        'water the plants, then rest',
        '',
        'Call Mum (she is out until 5).',
      ],
      [
        'function pick(list, n) {',
        '  const out = [];',
        '  for (let i = 0; i < n; i++) {',
        '    out.push(list[i]);',
        '  }',
        '  return out;',
        '}',
        '',
        'pick([4, 8, 15, 16, 23, 42], 3);',
      ],
      [
        'Dear Sam,',
        '',
        'Thanks for the book (the red',
        'one). I read it in two days,',
        'end to end.',
        '',
        'See you soon, Dad',
      ],
      [
        'let grid = [[1, 2], [3, 4]];',
        'sum = (grid[0][0] + grid[1][1]);',
        '',
        'if (sum > 4) {',
        '  show(sum, (sum * 2));',
        '}',
      ],
    ],
  },
];

/** The keys of the motions allowed in the Lesson at `index`: its own and every earlier Lesson's. */
export function lessonKeys(index: number): (keyof typeof motions)[] {
  return lessons.slice(0, index + 1).flatMap((lesson) => lesson.adds);
}

/** The motions allowed in the Lesson at `index`. */
export function lessonMotions(index: number): Motions {
  return Object.fromEntries(lessonKeys(index).map((key) => [key, motions[key]]));
}
