// The fewest key presses from a cursor to each place in a text, with a Lesson's motions.
// A search outward by key presses (Dijkstra's, with costs of a few keys), using the
// engine's own motions, so the search and the page can never disagree.
import { runMotion, type Cursor, type Motions, type Place, type Text } from './vim';

/** The search goes no further than this many key presses, which keeps it fast. */
const defaultMostKeys = 6;

/** A place as a map key: `line:col`. */
export function placeKey(place: Place): string {
  return `${place.line}:${place.col}`;
}

/** Keys to type a count: none for no count, else its digits. */
function countKeys(count: number | undefined): number {
  return count === undefined ? 0 : String(count).length;
}

/**
 * The fewest key presses (a count's digits included, Shift not counted) from `from` to
 * every place the `allowed` motions reach within `mostKeys`, keyed by `placeKey`. The
 * start is left out.
 *
 * The search tells cursors apart by place, the column j and k want, and the last find
 * (which ; and , repeat); a motion that keeps more in the cursor must add it to
 * `cursorKey`. A motion that waits for a character (f, t) is tried with each character
 * on the cursor's line, and costs a key more. (A find that fails is never the cheapest
 * way to set up a ; or , on another line: typing it there costs the same.)
 */
export function fewestKeys(
  text: Text,
  from: Cursor,
  allowed: Motions,
  mostKeys = defaultMostKeys,
): Map<string, number> {
  // Cursors as numbers, which makes the search several times faster than strings do.
  const width = Math.max(...text.map((line) => line.length)) + 2;
  const chars = [...new Set([...text.join(''), ...(from.lastFind?.char ?? '')])];
  const findKinds = ['f', 'F', 't', 'T'];
  // 0 for no find yet, else one number for each kind of find and character.
  const findIndex = (cursor: Cursor) =>
    cursor.lastFind
      ? 1 + findKinds.indexOf(cursor.lastFind.kind) * chars.length + chars.indexOf(cursor.lastFind.char)
      : 0;
  const cursorKey = (cursor: Cursor) =>
    ((cursor.line * width + cursor.col) * width + Math.min(cursor.want, width - 1)) *
      (findKinds.length * chars.length + 1) +
    findIndex(cursor);
  // The characters on each line, which are the ones f and t can look for.
  const lineChars = text.map((line) => [...new Set(line)]);
  // No motion repeats usefully more times than the text has characters.
  const mostRepeats = text.reduce((sum, line) => sum + line.length + 1, 0);
  const mostCount = Math.max(text.length, width);
  const motionList = Object.entries(allowed).map(([name, motion]) => ({
    motion,
    // A motion that takes a character costs a key more.
    keys: name.length + (motion.takesChar ? 1 : 0),
    // One step from each cursor, kept: walking the counts asks for the same steps often.
    steps: new Map<number, Cursor>(),
  }));

  const fewest = new Map<string, number>();
  const seen = new Map<number, number>([[cursorKey(from), 0]]);
  // Cursors waiting to be looked at, by the keys it took to reach them.
  const waiting: Cursor[][] = [[from]];
  const reached = (next: Cursor, total: number) => {
    const place = placeKey(next);
    if ((fewest.get(place) ?? Infinity) > total) fewest.set(place, total);
    // Cursors reached with no keys left to type are not looked at again.
    if (total >= mostKeys) return;
    const key = cursorKey(next);
    if ((seen.get(key) ?? Infinity) <= total) return;
    seen.set(key, total);
    (waiting[total] ??= []).push(next);
  };

  for (let keys = 0; keys < mostKeys; keys++) {
    for (const cursor of waiting[keys] ?? []) {
      if (seen.get(cursorKey(cursor))! < keys) continue;
      const budget = mostKeys - keys;
      for (const { motion, keys: motionKeys, steps } of motionList) {
        if (motionKeys > budget) continue;
        // The characters this motion is tried with: none, or each one on this line.
        const typedChars = motion.takesChar ? lineChars[cursor.line]! : [undefined];
        for (const char of typedChars) {
          if (motion.count === 'none') {
            reached(runMotion(text, cursor, motion, undefined, char), keys + motionKeys);
          } else if (motion.count === 'own') {
            reached(runMotion(text, cursor, motion, undefined, char), keys + motionKeys);
            // Counts go on until two in a row give the same cursor: after that, every
            // larger count does too, as a count past the last line or last match does.
            // (Not tested from 1 to 2: `;` after t skips a match that a count of 2 doesn't.)
            let last = -1;
            for (let count = 1; count <= mostCount; count++) {
              const cost = motionKeys + countKeys(count);
              if (cost > budget) break;
              const next = runMotion(text, cursor, motion, count, char);
              const nextKey = cursorKey(next);
              if (count > 2 && nextKey === last) break;
              last = nextKey;
              reached(next, keys + cost);
            }
          } else {
            // Each count is one more step from the last, until the motion goes no further.
            let at = cursor;
            for (let count = 1; count <= mostRepeats; count++) {
              const cost = motionKeys + (count === 1 ? 0 : countKeys(count));
              if (cost > budget) break;
              const atKey = cursorKey(at);
              let next = steps.get(atKey);
              if (!next) steps.set(atKey, (next = motion.move(text, at)));
              if (cursorKey(next) === atKey) break;
              at = next;
              reached(at, keys + cost);
            }
          }
        }
      }
    }
  }
  fewest.delete(placeKey(from));
  return fewest;
}
