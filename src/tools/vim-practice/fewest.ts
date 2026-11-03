// The fewest key presses from a cursor to each place in a text, with a Lesson's motions.
// A search outward by key presses (Dijkstra's, with costs of a few keys), using the
// engine's own motions, so the search and the page can never disagree.
import { runMotion, type Cursor, type Motions, type Place, type Text } from './vim';

/** The search goes no further than this many key presses, which keeps it fast. */
export const defaultMostKeys = 8;

/** A place as a map key: `line:col`. */
export function placeKey(place: Place): string {
  return `${place.line}:${place.col}`;
}

function cursorKey(cursor: Cursor): string {
  return `${cursor.line}:${cursor.col}:${cursor.want}`;
}

/** Keys to type a count: none for no count, else its digits. */
function countKeys(count: number | undefined): number {
  return count === undefined ? 0 : String(count).length;
}

/** Every cursor one motion (with a count, or none) away, and the keys it takes. */
function* moves(text: Text, from: Cursor, allowed: Motions): Generator<[Cursor, number]> {
  // A count past this repeats nothing new in a block of text this size.
  const longest = Math.max(text.length, ...text.map((line) => line.length));
  for (const [name, motion] of Object.entries(allowed)) {
    const keys = name.length;
    if (motion.count === 'none') {
      yield [runMotion(text, from, motion), keys];
    } else if (motion.count === 'own') {
      yield [runMotion(text, from, motion), keys];
      for (let count = 1; count <= text.length; count++) {
        yield [runMotion(text, from, motion, count), keys + countKeys(count)];
      }
    } else {
      // Each count is one more step from the last, so the counts cost one step each.
      let cursor = from;
      for (let count = 1; count <= longest; count++) {
        const next = motion.move(text, cursor);
        if (cursorKey(next) === cursorKey(cursor)) break;
        cursor = next;
        yield [cursor, keys + (count === 1 ? 0 : countKeys(count))];
      }
    }
  }
}

/**
 * The fewest key presses (a count's digits included, Shift not counted) from `from` to
 * every place the `allowed` motions reach within `mostKeys`, keyed by `placeKey`. The
 * start is left out.
 */
export function fewestKeys(
  text: Text,
  from: Cursor,
  allowed: Motions,
  mostKeys = defaultMostKeys,
): Map<string, number> {
  const fewest = new Map<string, number>();
  const seen = new Map<string, number>([[cursorKey(from), 0]]);
  // Cursors waiting to be looked at, by the keys it took to reach them.
  const waiting: Cursor[][] = [[from]];
  for (let keys = 0; keys <= mostKeys; keys++) {
    for (const cursor of waiting[keys] ?? []) {
      if (seen.get(cursorKey(cursor))! < keys) continue;
      for (const [next, cost] of moves(text, cursor, allowed)) {
        const total = keys + cost;
        if (total > mostKeys) continue;
        const key = cursorKey(next);
        if ((seen.get(key) ?? Infinity) <= total) continue;
        seen.set(key, total);
        (waiting[total] ??= []).push(next);
        const place = placeKey(next);
        if ((fewest.get(place) ?? Infinity) > total) fewest.set(place, total);
      }
    }
  }
  fewest.delete(placeKey(from));
  return fewest;
}

