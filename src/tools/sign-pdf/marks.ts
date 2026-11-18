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
