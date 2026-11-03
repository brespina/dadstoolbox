// A round of Drills in one Lesson: the Drills, the key presses for each, and the score.
// The page turns each key event into one `press`.
import type { Random } from '../../practice/random';
import { fewestKeys, placeKey } from './fewest';
import { lessonMotions, lessons } from './lessons';
import { feed, startState, type Place, type Text, type VimState } from './vim';

export const drillsInRound = 10;

/** One Drill: move the cursor from `start` to `target` in `text`. */
export interface Drill {
  text: Text;
  start: Place;
  target: Place;
  /** The fewest key presses that do it with the Lesson's motions. */
  fewest: number;
}

export interface Round {
  lesson: number;
  drills: readonly Drill[];
  /** The Drill being played; `drills.length` once the round is done. */
  current: number;
  /** The engine's state in the current Drill. */
  vim: VimState;
  /** Key presses for each Drill so far. */
  presses: readonly number[];
  /** The last key pressed, when it isn't a motion in this Lesson, to note it. */
  ignored?: string;
  /** When the first key was pressed, and when the last Drill was done (milliseconds). */
  startedAt?: number;
  doneAt?: number;
}

/** Drills ask for at least this many keys, so each one needs a little thought. */
const fewestForADrill = 2;

function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

function nonBlankPlaces(text: Text): Place[] {
  return text.flatMap((line, l) =>
    [...line].flatMap((char, col) => (char === ' ' ? [] : [{ line: l, col }])),
  );
}

/**
 * A Drill in the Lesson: a random text, start and target, on characters that aren't
 * spaces. Targets where the Lesson's own motions save keys over the earlier Lessons'
 * are preferred, so the new motions get used.
 */
function newDrill(lesson: number, random: Random): Drill {
  const text = pick(random, lessons[lesson]!.texts);
  const start = pick(random, nonBlankPlaces(text));
  const cursor = { ...start, want: start.col };
  const reach = fewestKeys(text, cursor, lessonMotions(lesson));
  // A Lesson that adds no motions (Mixed) has nothing to prefer, so skips the second search.
  const adds = lessons[lesson]!.adds.length > 0;
  const before =
    adds && lesson > 0 ? fewestKeys(text, cursor, lessonMotions(lesson - 1)) : undefined;
  const targets = nonBlankPlaces(text).filter(
    (place) => (reach.get(placeKey(place)) ?? 0) >= fewestForADrill,
  );
  const better = targets.filter((place) => {
    const keys = before?.get(placeKey(place));
    return keys === undefined || keys > reach.get(placeKey(place))!;
  });
  // A start with nowhere to go (rare in a tidy text) draws again.
  if (targets.length === 0) return newDrill(lesson, random);
  const target = pick(random, better.length > 0 ? better : targets);
  return { text, start, target, fewest: reach.get(placeKey(target))! };
}

export function newRound(lesson: number, random: Random): Round {
  const drills = Array.from({ length: drillsInRound }, () => newDrill(lesson, random));
  return {
    lesson,
    drills,
    current: 0,
    vim: startState(drills[0]!.start),
    presses: drills.map(() => 0),
  };
}

/**
 * One key pressed, as `KeyboardEvent.key` names it, at `at` milliseconds. Every key
 * counts, Escape and ignored keys too; the page leaves out Shift and the like.
 */
export function press(round: Round, key: string, at: number): Round {
  if (round.current >= round.drills.length) return round;
  const drill = round.drills[round.current]!;
  const { state, outcome } = feed(drill.text, round.vim, key, lessonMotions(round.lesson));
  const presses = round.presses.map((count, i) => (i === round.current ? count + 1 : count));
  const next: Round = {
    ...round,
    vim: state,
    presses,
    ignored: outcome === 'ignored' ? key : undefined,
    startedAt: round.startedAt ?? at,
  };
  const { cursor } = state;
  if (cursor.line !== drill.target.line || cursor.col !== drill.target.col) return next;
  const current = round.current + 1;
  const following = round.drills[current];
  return {
    ...next,
    current,
    vim: following ? startState(following.start) : state,
    doneAt: following ? undefined : at,
  };
}

export interface Results {
  seconds: number;
  presses: number;
  fewest: number;
  /** Up to three Drills that took the most keys over the fewest, worst first. */
  mostExtra: { drill: number; presses: number; fewest: number; extra: number }[];
}

/** The round's score, once the last Drill is done. */
export function results(round: Round): Results | undefined {
  if (round.doneAt === undefined || round.startedAt === undefined) return undefined;
  const drills = round.drills.map((drill, i) => ({
    drill: i,
    presses: round.presses[i]!,
    fewest: drill.fewest,
    extra: round.presses[i]! - drill.fewest,
  }));
  return {
    seconds: Math.round((round.doneAt - round.startedAt) / 100) / 10,
    presses: drills.reduce((sum, d) => sum + d.presses, 0),
    fewest: drills.reduce((sum, d) => sum + d.fewest, 0),
    mostExtra: drills
      .filter((d) => d.extra > 0)
      .sort((a, b) => b.extra - a.extra || a.drill - b.drill)
      .slice(0, 3),
  };
}
