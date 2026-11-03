// Vim practice's engine: Vim's cursor motions over a block of text, as pure functions.
// Text is a list of lines; the cursor sits on a character, as in Vim's Normal mode.
// The motions follow Vim (not Neovim) defaults; see `:help motion.txt`.

/** The text of a Drill, one string per line, with no tabs. */
export type Text = readonly string[];

/** A place in the text: a line and a character in it, both counted from 0. */
export interface Place {
  line: number;
  col: number;
}

/**
 * Where the cursor is, and the column j and k try to keep (Vim's "curswant"): moving to
 * a shorter line and back returns to it. `Infinity` after `$`: the end of every line.
 */
export interface Cursor extends Place {
  want: number;
  /** The last f, F, t or T typed, which ; and , repeat. Kept even if the find failed. */
  lastFind?: Find;
}

/** A find on a line: `f`, `F`, `t` or `T`, and the character looked for. */
export interface Find {
  kind: 'f' | 'F' | 't' | 'T';
  char: string;
}

/**
 * One motion, keyed in `Motions` by the keys that type it (`w`, or `gg` for a motion
 * typed with two keys).
 *
 * `count` says what a typed count does:
 * - `repeat`: the motion runs that many times, stopping early where it can go no further
 *   (`3w`, `12j`). `move` is called with no count.
 * - `own`: the motion reads the count itself (`5$`); `move` gets it, or `undefined` when
 *   none was typed.
 * - `none`: the count is dropped (`3^` is `^`).
 *
 * `takesChar` marks a motion that waits for one more character after its keys (`f,`):
 * `move` gets that character as its last argument.
 *
 * `repeatsFind` marks a motion that reads the cursor's `lastFind` (`;` and `,`).
 *
 * `move` returns the cursor unchanged when the motion can't go anywhere.
 */
export interface Motion {
  count: 'repeat' | 'own' | 'none';
  takesChar?: true;
  repeatsFind?: true;
  move(text: Text, from: Cursor, count?: number, char?: string): Cursor;
}

export type Motions = Readonly<Record<string, Motion>>;

/** The engine's whole state: the cursor, and a count or keys typed so far. */
export interface VimState {
  cursor: Cursor;
  /** A count typed but not yet used by a motion. */
  count?: number;
  /** Keys typed of a motion that needs more: `g` of `gg`, or `f` before its character. */
  keys?: string;
}

/**
 * What a key did:
 * - `moved`: a motion ran (the cursor may have stayed put, as `l` does on the last character)
 * - `count`: a digit of a count
 * - `pending`: the start of a motion that needs more keys (`g`, or `f` before its character)
 * - `cancelled`: Escape, which drops a half-typed count or motion
 * - `ignored`: not one of the allowed motions; any half-typed count or motion is dropped too
 */
export type Outcome = 'moved' | 'count' | 'pending' | 'cancelled' | 'ignored';

/** Counts larger than this are read as this. */
const largestCount = 9999;

export function startState(place: Place): VimState {
  return { cursor: { ...place, want: place.col } };
}

/** The column of the last character of a line (0 on an empty line). */
export function lastCol(text: Text, line: number): number {
  return Math.max(0, text[line]!.length - 1);
}

/** The cursor at a new column on its line; j and k will want that column. */
function toCol(from: Cursor, col: number): Cursor {
  return { ...from, col, want: col };
}

/** The cursor moved `by` lines (clamped to the text), on the column it wants. */
function toLine(text: Text, from: Cursor, by: number): Cursor {
  const line = Math.min(text.length - 1, Math.max(0, from.line + by));
  if (line === from.line) return from;
  return { ...from, line, col: Math.min(from.want, lastCol(text, line)) };
}

/** Runs a motion with the count typed before it (if any). */
export function runMotion(
  text: Text,
  from: Cursor,
  motion: Motion,
  count?: number,
  char?: string,
): Cursor {
  if (motion.count === 'own') return motion.move(text, from, count, char);
  if (motion.count === 'none') return motion.move(text, from);
  let cursor = from;
  for (let i = 0; i < (count ?? 1); i++) {
    const next = motion.move(text, cursor);
    if (samePlace(next, cursor) && next.want === cursor.want) break;
    cursor = next;
  }
  return cursor;
}

function samePlace(a: Place, b: Place): boolean {
  return a.line === b.line && a.col === b.col;
}

// Word motions, as Vim's search.c does them: step one character at a time, where the end
// of each line (col === line length) is a place of its own that counts as white space,
// so a line end separates words. A word is a run of letters, digits and _, or a run of
// other non-blank characters; a WORD is any run of non-blank characters. An empty line
// counts as a word for w and b.

/** 0: white space or a line end; 1: punctuation (or, for WORDs, any character); 2: letters. */
function kind(text: Text, at: Place, bigWord: boolean): number {
  const char = text[at.line]![at.col];
  if (char === undefined || char === ' ' || char === '\t') return 0;
  if (bigWord) return 1;
  return /[\p{L}\p{N}_]/u.test(char) ? 2 : 1;
}

function onEmptyLine(text: Text, at: Place): boolean {
  return at.col === 0 && text[at.line] === '';
}

/** One character forward, through line ends. False (and no move) at the end of the text. */
function forward(text: Text, at: Place): boolean {
  if (at.col < text[at.line]!.length) {
    at.col += 1;
    return true;
  }
  if (at.line === text.length - 1) return false;
  at.line += 1;
  at.col = 0;
  return true;
}

/** One character back, through line ends. False (and no move) at the start of the text. */
function backward(text: Text, at: Place): boolean {
  if (at.col > 0) {
    at.col -= 1;
    return true;
  }
  if (at.line === 0) return false;
  at.line -= 1;
  at.col = text[at.line]!.length;
  return true;
}

/** Vim's fwd_word. */
function nextWordStart(text: Text, from: Place, bigWord: boolean): Place {
  const at = { ...from };
  const start = kind(text, at, bigWord);
  if (!forward(text, at)) return at;
  if (start !== 0) {
    while (kind(text, at, bigWord) === start) if (!forward(text, at)) return at;
  }
  while (kind(text, at, bigWord) === 0 && !onEmptyLine(text, at)) {
    if (!forward(text, at)) return at;
  }
  return at;
}

/** Vim's bck_word. */
function wordStartBefore(text: Text, from: Place, bigWord: boolean): Place {
  const at = { ...from };
  if (!backward(text, at)) return at;
  while (kind(text, at, bigWord) === 0) {
    if (onEmptyLine(text, at)) return at;
    if (!backward(text, at)) return at;
  }
  const run = kind(text, at, bigWord);
  while (kind(text, at, bigWord) === run) if (!backward(text, at)) return at;
  forward(text, at);
  return at;
}

/** Vim's end_word. */
function nextWordEnd(text: Text, from: Place, bigWord: boolean): Place {
  const at = { ...from };
  const start = kind(text, at, bigWord);
  if (!forward(text, at)) return at;
  if (start !== 0 && kind(text, at, bigWord) === start) {
    while (kind(text, at, bigWord) === start) if (!forward(text, at)) return at;
  } else {
    while (kind(text, at, bigWord) === 0) if (!forward(text, at)) return at;
    const run = kind(text, at, bigWord);
    while (kind(text, at, bigWord) === run) if (!forward(text, at)) return at;
  }
  backward(text, at);
  return at;
}

/**
 * A word motion as a Motion. Vim leaves the cursor on the last character, not past it,
 * and always takes the new column as the one j and k want.
 */
function wordMotion(find: (text: Text, from: Place, bigWord: boolean) => Place, bigWord: boolean) {
  return {
    count: 'repeat',
    move: (text, from) => {
      const at = find(text, from, bigWord);
      return { ...toCol(from, Math.min(at.col, lastCol(text, at.line))), line: at.line };
    },
  } satisfies Motion;
}

/** The column of the first character that isn't a space; the last one on a line of spaces. */
function firstNonBlank(text: Text, line: number): number {
  return Math.min(text[line]!.search(/[^ \t]|$/), lastCol(text, line));
}

/** The cursor on a line (clamped to the text), at its first non-blank: Vim's 'startofline'. */
function toLineNumber(text: Text, from: Cursor, line: number): Cursor {
  const clamped = Math.min(text.length - 1, Math.max(0, line));
  return toCol({ ...from, line: clamped }, firstNonBlank(text, clamped));
}

/**
 * Vim's searchc: the `count`-th `char` along the line from the cursor, to the right for
 * f and t, to the left for F and T. A failed find leaves the cursor where it is. t and T
 * stop one character short. A repeat of t or T (`;` or `,`) with a count of 1 skips a
 * match right next to the cursor, so it always moves (Vim's default 'cpoptions' has no
 * `;`). Every find, failed ones too, becomes `remembered`, the find `;` and `,` repeat.
 */
function find(
  text: Text,
  from: Cursor,
  { kind, char }: Find,
  count: number,
  repeated: boolean,
  remembered: Find,
): Cursor {
  const line = text[from.line]!;
  const step = kind === 'f' || kind === 't' ? 1 : -1;
  const till = kind === 't' || kind === 'T';
  let skipNext = repeated && till && count === 1;
  let col = from.col;
  for (let found = 0; found < count; found++) {
    for (;;) {
      col += step;
      if (col < 0 || col >= line.length) return { ...from, lastFind: remembered };
      if (line[col] === char && !skipNext) break;
      skipNext = false;
    }
  }
  if (till) col -= step;
  return { ...toCol(from, col), lastFind: remembered };
}

const opposite = { f: 'F', F: 'f', t: 'T', T: 't' } as const;

/** A find typed as a motion: f, F, t or T, then the character. */
function findMotion(kind: Find['kind']) {
  return {
    count: 'own',
    takesChar: true,
    move: (text, from, count = 1, char) => {
      if (char === undefined) return from;
      const typed = { kind, char };
      return find(text, from, typed, count, false, typed);
    },
  } satisfies Motion;
}

/** `;` and `,`: the last find again, the same way or the other way round. */
function repeatFind(reverse: boolean) {
  return {
    count: 'own',
    repeatsFind: true,
    move: (text, from, count = 1) => {
      const last = from.lastFind;
      if (!last) return from;
      const kind = reverse ? opposite[last.kind] : last.kind;
      return find(text, from, { kind, char: last.char }, count, true, last);
    },
  } satisfies Motion;
}

/**
 * Vim's findpar, for } (`step` 1) and { (-1). A paragraph boundary is an empty line (a
 * line of spaces is not one; Vim also stops at a form feed or an nroff macro such as
 * `.PP` at the start of a line, which the Lessons' texts leave out). Each paragraph moves
 * to the first boundary after a non-empty line; a run of empty lines is one boundary. The
 * cursor lands in the first column, except that } onto the last line goes to its last
 * character. With no boundary left, the last paragraph asked for goes to the end of the
 * text (the first line for {, the last character of the last line for }, and that even
 * when already there), but an earlier one that runs out makes the motion fail.
 */
function paragraphMotion(step: 1 | -1) {
  return {
    count: 'own',
    move: (text, from, count = 1) => {
      let line = from.line;
      for (let left = count; left > 0; left--) {
        let skipped = false;
        for (let first = true; ; first = false) {
          const empty = text[line] === '';
          if (!empty) skipped = true;
          if (!first && skipped && empty) break;
          const next = line + step;
          if (next < 0 || next >= text.length) {
            // Even a failed } or { takes the column it is on as the one wanted.
            if (left > 1) return { ...from, want: from.col };
            break;
          }
          line = next;
        }
      }
      const col = step === 1 && line === text.length - 1 ? lastCol(text, line) : 0;
      return { ...from, line, col, want: col };
    },
  } satisfies Motion;
}

/** The brackets `%` matches (Vim's 'matchpairs'): each one, and the bracket it pairs with. */
const bracketPairs: Readonly<Record<string, string>> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
};

/**
 * Vim's findmatchlimit, for `%` in the cases the Lessons' texts keep to: from the bracket
 * under the cursor, or else the first one after it on the line, to its match, which is
 * found by counting only brackets of the same kind, over any number of lines. Fails (stays
 * put) with no bracket on the rest of the line, or no match. Vim also skips brackets in
 * double quotes and in C comments, and takes a backslash before one as escaping it; the
 * Lessons' texts have none of those, so the engine doesn't either.
 */
function matchingBracket(text: Text, from: Cursor): Cursor {
  const start = text[from.line]!.slice(from.col).search(/[()[\]{}]/);
  if (start < 0) return from;
  const open = text[from.line]![from.col + start]!;
  const close = bracketPairs[open]!;
  const forwards = '([{'.includes(open);
  const at = { line: from.line, col: from.col + start };
  let depth = 0;
  while (forwards ? forward(text, at) : backward(text, at)) {
    const char = text[at.line]![at.col];
    if (char === open) depth++;
    else if (char === close && depth-- === 0) return { ...toCol(from, at.col), line: at.line };
  }
  return from;
}

/** Every motion the engine knows, keyed by the keys that type it. */
export const motions = {
  h: {
    count: 'repeat',
    move: (_text, from) => (from.col > 0 ? toCol(from, from.col - 1) : from),
  },
  l: {
    count: 'repeat',
    move: (text, from) => (from.col < lastCol(text, from.line) ? toCol(from, from.col + 1) : from),
  },
  j: { count: 'repeat', move: (text, from) => toLine(text, from, 1) },
  k: { count: 'repeat', move: (text, from) => toLine(text, from, -1) },
  w: wordMotion(nextWordStart, false),
  b: wordMotion(wordStartBefore, false),
  e: wordMotion(nextWordEnd, false),
  W: wordMotion(nextWordStart, true),
  B: wordMotion(wordStartBefore, true),
  E: wordMotion(nextWordEnd, true),
  '0': { count: 'none', move: (_text, from) => toCol(from, 0) },
  '^': {
    count: 'none',
    // The first character that isn't a space; on a line of spaces, the last one.
    move: (text, from) => toCol(from, firstNonBlank(text, from.line)),
  },
  $: {
    // `N$` goes N-1 lines down first, and fails (but still wants the line end) on the
    // last line; past the last line it stops there, as j does.
    count: 'own',
    move: (text, from, count = 1) => {
      const down = count - 1;
      if (down > 0 && from.line === text.length - 1) return { ...from, want: Infinity };
      const line = Math.min(text.length - 1, from.line + down);
      return { ...from, line, col: lastCol(text, line), want: Infinity };
    },
  },
  f: findMotion('f'),
  F: findMotion('F'),
  t: findMotion('t'),
  T: findMotion('T'),
  ';': repeatFind(false),
  ',': repeatFind(true),
  // A count is the line to go to; with none, G is the last line and gg the first.
  G: {
    count: 'own',
    move: (text, from, count) => toLineNumber(text, from, (count ?? text.length) - 1),
  },
  gg: {
    count: 'own',
    move: (text, from, count) => toLineNumber(text, from, (count ?? 1) - 1),
  },
  // Vim's `N%` goes N percent down the text; the Lessons don't teach it, so a count is dropped.
  '%': { count: 'none', move: matchingBracket },
  '}': paragraphMotion(1),
  '{': paragraphMotion(-1),
} satisfies Motions;

/**
 * One key pressed in Normal mode, as `KeyboardEvent.key` names it. Only the `allowed`
 * motions run; any other key is ignored.
 */
export function feed(
  text: Text,
  state: VimState,
  key: string,
  allowed: Motions,
): { state: VimState; outcome: Outcome } {
  const { cursor, count, keys } = state;
  const motionNamed = (name: string) => (Object.hasOwn(allowed, name) ? allowed[name] : undefined);
  if (key === 'Escape') return { state: { cursor }, outcome: 'cancelled' };
  // After f, F, t or T, the next key is the character looked for, whatever it is.
  const waiting = keys === undefined ? undefined : motionNamed(keys);
  if (waiting?.takesChar) {
    if (key.length !== 1) return { state: { cursor }, outcome: 'ignored' };
    return { state: { cursor: runMotion(text, cursor, waiting, count, key) }, outcome: 'moved' };
  }
  // A 0 with no count yet is the `0` motion; after a digit it is part of the count. After
  // the start of a motion such as g, a digit is not a count.
  if (keys === undefined && (/^[1-9]$/.test(key) || (key === '0' && count !== undefined))) {
    const typed = Math.min(largestCount, (count ?? 0) * 10 + Number(key));
    return { state: { cursor, count: typed }, outcome: 'count' };
  }
  const typed = (keys ?? '') + key;
  const motion = motionNamed(typed);
  if (motion?.takesChar) return { state: { cursor, count, keys: typed }, outcome: 'pending' };
  if (motion) {
    return { state: { cursor: runMotion(text, cursor, motion, count) }, outcome: 'moved' };
  }
  // Some allowed motion starts with these keys (the g of gg): wait for the rest.
  if (Object.keys(allowed).some((name) => name.startsWith(typed))) {
    return { state: { cursor, count, keys: typed }, outcome: 'pending' };
  }
  return { state: { cursor }, outcome: 'ignored' };
}
