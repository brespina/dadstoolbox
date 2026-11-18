// How a Mark moves and changes size on its page: plain rules with no page or browser in
// them, so Vitest covers them and the editor only turns events into calls. Every Mark
// kind uses them. A Mark's place is `x`, `y` and `width`, fractions of the page as shown
// (ADR-0007); its height is never stored, it follows from the picture's shape.

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

/** The Mark moved the least it takes to lie wholly inside its page. */
export function keepInside(mark: Mark, fit: Fit): Mark {
  return {
    ...mark,
    x: between(mark.x, 0, 1 - mark.width),
    y: between(mark.y, 0, 1 - heightOf(mark, fit)),
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
 * Smaller or Bigger: a tenth off or on the width, about the Mark's centre, within the
 * smallest and largest sizes, then kept inside the page.
 */
export function resize(mark: Mark, way: 'smaller' | 'bigger', fit: Fit): Mark {
  const factor = way === 'bigger' ? sizeStep : 1 / sizeStep;
  const width = Math.min(Math.max(mark.width * factor, smallest), Math.max(smallest, widest(fit)));
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
