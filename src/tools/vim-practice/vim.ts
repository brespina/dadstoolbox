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
 * `move` returns the cursor unchanged when the motion can't go anywhere.
 */
export interface Motion {
  count: 'repeat' | 'own' | 'none';
  move(text: Text, from: Cursor, count?: number): Cursor;
}

export type Motions = Readonly<Record<string, Motion>>;

/** The engine's whole state: the cursor, and a count typed so far. */
export interface VimState {
  cursor: Cursor;
  /** A count typed but not yet used by a motion. */
  count?: number;
}

/**
 * What a key did:
 * - `moved`: a motion ran (the cursor may have stayed put, as `l` does on the last character)
 * - `count`: a digit of a count
 * - `cancelled`: Escape, which drops a half-typed count
 * - `ignored`: not one of the allowed motions; any half-typed count is dropped too
 */
export type Outcome = 'moved' | 'count' | 'cancelled' | 'ignored';

/** Counts larger than this are read as this. */
export const largestCount = 9999;

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
export function runMotion(text: Text, from: Cursor, motion: Motion, count?: number): Cursor {
  if (motion.count === 'own') return motion.move(text, from, count);
  if (motion.count === 'none') return motion.move(text, from);
  let cursor = from;
  for (let i = 0; i < (count ?? 1); i++) {
    const next = motion.move(text, cursor);
    if (samePlace(next, cursor) && next.want === cursor.want) break;
    cursor = next;
  }
  return cursor;
}

export function samePlace(a: Place, b: Place): boolean {
  return a.line === b.line && a.col === b.col;
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
  const { cursor, count } = state;
  if (key === 'Escape') return { state: { cursor }, outcome: 'cancelled' };
  // A 0 with no count yet is the `0` motion; after a digit it is part of the count.
  if (/^[1-9]$/.test(key) || (key === '0' && count !== undefined)) {
    const typed = Math.min(largestCount, (count ?? 0) * 10 + Number(key));
    return { state: { cursor, count: typed }, outcome: 'count' };
  }
  const motion = Object.hasOwn(allowed, key) ? allowed[key] : undefined;
  if (!motion) return { state: { cursor }, outcome: 'ignored' };
  return { state: { cursor: runMotion(text, cursor, motion, count) }, outcome: 'moved' };
}
