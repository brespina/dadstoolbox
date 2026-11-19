// How a Mark moves and changes size on its page: plain rules with no page or browser in
// them, so Vitest covers them and the editor only turns events into calls. Every Mark
// kind uses them. A Mark's place is `x`, `y` and `width`, fractions of the page as shown
// (ADR-0007); its height is never stored, it follows from the picture's shape.

import { isShortcut } from '../../practice/keys';
import type { Mark } from './declaration';

/**
 * The two shapes that give a Mark's height: its picture's (width ÷ height) and the page's
 * as shown (width ÷ height).
 */
export interface Fit {
  markAspect: number;
  pageAspect: number;
}

/** An arrow key's way. */
export type Direction = 'left' | 'right' | 'up' | 'down';

/** An arrow key moves a Mark this far, as a fraction of the page… */
export const step = 0.01;
/** …and this far with Shift held. */
export const bigStep = 0.1;

/** A Mark's height, as a fraction of the page's height. */
export function heightOf(mark: Pick<Mark, 'width'>, { markAspect, pageAspect }: Fit): number {
  return (mark.width * pageAspect) / markAspect;
}

const between = (value: number, least: number, most: number) =>
  Math.min(Math.max(value, least), Math.max(least, most));

/**
 * The Mark moved the least it takes to lie wholly inside its page, and made narrower first
 * if its picture's shape would make it taller than the page (as when a Signature drawn
 * after the Mark was placed is taller than the pad's shape it was placed with).
 */
export function keepInside(mark: Mark, fit: Fit): Mark {
  const width = Math.min(mark.width, widest(fit));
  return {
    ...mark,
    width,
    x: between(mark.x, 0, 1 - width),
    y: between(mark.y, 0, 1 - heightOf({ width }, fit)),
  };
}

/** An arrow key's move: 1% of the page (10% with Shift), kept inside the page. */
export function nudge(mark: Mark, direction: Direction, big: boolean, fit: Fit): Mark {
  const by = big ? bigStep : step;
  const moved = { ...mark };
  if (direction === 'left') moved.x -= by;
  if (direction === 'right') moved.x += by;
  if (direction === 'up') moved.y -= by;
  if (direction === 'down') moved.y += by;
  return keepInside(moved, fit);
}

/** Smaller and Bigger change a Mark's width by this much each time… */
export const sizeStep = 1.1;
/** …down to this width, a twentieth of the page… */
export const smallest = 0.05;
/** …and up to the page's whole width (less, if the Mark would then be taller than the page). */
export const largest = 1;

/** The widest a Mark may be: no wider than the page, and no taller than it. */
function widest(fit: Fit): number {
  return Math.min(largest, fit.markAspect / fit.pageAspect);
}

/**
 * Smaller or Bigger: the width a tenth more (Bigger) or the same step back (Smaller, so it
 * undoes Bigger), about the Mark's centre, within the smallest and largest sizes, then kept
 * inside the page.
 */
export function resize(mark: Mark, way: 'smaller' | 'bigger', fit: Fit): Mark {
  const factor = way === 'bigger' ? sizeStep : 1 / sizeStep;
  const width = between(mark.width * factor, smallest, widest(fit));
  const before = heightOf(mark, fit);
  const after = heightOf({ width }, fit);
  return keepInside(
    {
      ...mark,
      width,
      x: mark.x + (mark.width - width) / 2,
      y: mark.y + (before - after) / 2,
    },
    fit,
  );
}

/** A new Mark's width: a third of the page for a Signature. #112 adds the other kinds. */
export function startingWidth(_kind: Mark['kind']): number {
  return 1 / 3;
}

/** A point on a page, as fractions of the page as shown. */
export interface Point {
  x: number;
  y: number;
}

/** A new Mark of this kind on `page`, centred on `point` (a tap), kept inside the page. */
export function placeCentred(kind: Mark['kind'], page: number, point: Point, fit: Fit): Mark {
  const width = startingWidth(kind);
  const height = heightOf({ width }, fit);
  return keepInside({ kind, page, x: point.x - width / 2, y: point.y - height / 2, width }, fit);
}

/** Where "Add to page" puts a new Mark: centred across, and four fifths of the way down. */
export function placeLowerMiddle(kind: Mark['kind'], page: number, fit: Fit): Mark {
  return placeCentred(kind, page, { x: 0.5, y: 0.8 }, fit);
}

/**
 * A drag: the Mark with the point it was grabbed at (`grab`, its distance from the Mark's
 * top-left, as fractions of the page) under the pointer, kept inside the page.
 */
export function dragTo(mark: Mark, grab: Point, pointer: Point, fit: Fit): Mark {
  return keepInside({ ...mark, x: pointer.x - grab.x, y: pointer.y - grab.y }, fit);
}

/** What a key does to a chosen Mark. */
export type MarkAction =
  | { do: 'move'; direction: Direction; big: boolean }
  | { do: 'size'; way: 'smaller' | 'bigger' }
  | { do: 'remove' };

const arrows: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/**
 * What a key press does to a chosen Mark, or nothing (the browser keeps the key). Arrows
 * move, + and - resize (= and _ are the same keys without Shift), Delete and Backspace
 * remove. Shortcuts such as Ctrl+- (zoom) or Alt+Left (back) stay the browser's.
 */
export function actionFor(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>,
): MarkAction | undefined {
  if (isShortcut(event) || (event.altKey && event.key.length > 1)) return undefined;
  const direction = arrows[event.key];
  if (direction) return { do: 'move', direction, big: event.shiftKey };
  if (event.key === '+' || event.key === '=') return { do: 'size', way: 'bigger' };
  if (event.key === '-' || event.key === '_') return { do: 'size', way: 'smaller' };
  if (event.key === 'Delete' || event.key === 'Backspace') return { do: 'remove' };
  return undefined;
}
