// The fewest key presses from a cursor to each place in a text, with a Lesson's motions.
// A search outward by key presses (Dijkstra's, with costs of a few keys), using the
// engine's own motions, so the search and the page can never disagree.
import { runMotion, type Cursor, type Motions, type Place, type Text } from './vim';

/** The search goes no further than this many key presses, which keeps it fast. */
export const defaultMostKeys = 6;

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
 * The search tells cursors apart by place and the column j and k want; a motion that
 * keeps more in the cursor must add it to `cursorKey`.
 */
export function fewestKeys(
  text: Text,
  from: Cursor,
  allowed: Motions,
  mostKeys = defaultMostKeys,
): Map<string, number> {
  // Cursors as numbers, which makes the search several times faster than strings do.
  const width = Math.max(...text.map((line) => line.length)) + 2;
  const cursorKey = (cursor: Cursor) =>
    (cursor.line * width + cursor.col) * width + Math.min(cursor.want, width - 1);
  // No motion repeats usefully more times than the text has characters.
  const mostRepeats = text.reduce((sum, line) => sum + line.length + 1, 0);
  const motionList = Object.entries(allowed).map(([name, motion]) => ({
    motion,
    keys: name.length,
    // One step from each cursor, kept: walking the counts asks for the same steps often.
    steps: new Map<number, Cursor>(),
  }));

  const fewest = new Map<string, number>();
  const seen = new Map<number, number>([[cursorKey(from), 0]]);
  // Cursors waiting to be looked at, by the keys it took to reach them.
  const waiting: Cursor[][] = [[from]];
  const reached = (next: Cursor, total: number) => {
    const key = cursorKey(next);
    if ((seen.get(key) ?? Infinity) <= total) return;
    seen.set(key, total);
    (waiting[total] ??= []).push(next);
    const place = placeKey(next);
    if ((fewest.get(place) ?? Infinity) > total) fewest.set(place, total);
  };

  for (let keys = 0; keys < mostKeys; keys++) {
    for (const cursor of waiting[keys] ?? []) {
      if (seen.get(cursorKey(cursor))! < keys) continue;
      const budget = mostKeys - keys;
      for (const { motion, keys: motionKeys, steps } of motionList) {
        if (motionKeys > budget) continue;
        if (motion.count === 'none') {
          reached(runMotion(text, cursor, motion), keys + motionKeys);
        } else if (motion.count === 'own') {
          reached(runMotion(text, cursor, motion), keys + motionKeys);
          for (let count = 1; count <= text.length; count++) {
            const cost = motionKeys + countKeys(count);
            if (cost > budget) break;
            reached(runMotion(text, cursor, motion, count), keys + cost);
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
  fewest.delete(placeKey(from));
  return fewest;
}
