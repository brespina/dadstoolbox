import { describe, expect, it } from 'vitest';
import type { Mark } from './declaration';
import { nudge } from './marks';

// A page 300 × 200 points (1.5 as wide as it is high), and a Signature three times as
// wide as it is high. A Mark a third of the page wide is then 100 × 33.3 points: one
// sixth of the page's height.
const fit = { markAspect: 3, pageAspect: 1.5 };
const mark = (x: number, y: number, width = 1 / 3): Mark => ({
  kind: 'signature',
  page: 1,
  x,
  y,
  width,
});

describe('moving a Mark with the arrow keys', () => {
  it('steps by 1% of the page, across and down', () => {
    expect(nudge(mark(0.5, 0.5), 'right', false, fit).x).toBeCloseTo(0.51, 10);
    expect(nudge(mark(0.5, 0.5), 'down', false, fit).y).toBeCloseTo(0.51, 10);
  });

  it('steps back by 1% to the left and up', () => {
    const left = nudge(mark(0.5, 0.5), 'left', false, fit);
    const up = nudge(mark(0.5, 0.5), 'up', false, fit);
    expect(left.x).toBeCloseTo(0.49, 10);
    expect(left.y).toBe(0.5);
    expect(up.y).toBeCloseTo(0.49, 10);
    expect(up.x).toBe(0.5);
  });

  it('steps by 10% with Shift', () => {
    expect(nudge(mark(0.2, 0.2), 'right', true, fit).x).toBeCloseTo(0.3, 10);
    expect(nudge(mark(0.2, 0.2), 'down', true, fit).y).toBeCloseTo(0.3, 10);
  });

  it('changes only x and y', () => {
    const moved = nudge(mark(0.5, 0.5, 0.25), 'right', true, fit);
    expect(Object.keys(moved).sort()).toEqual(['kind', 'page', 'width', 'x', 'y']);
    expect(moved).toMatchObject({ kind: 'signature', page: 1, width: 0.25, y: 0.5 });
  });

  it('stops at the left and top edges', () => {
    expect(nudge(mark(0, 0.4), 'left', false, fit).x).toBe(0);
    expect(nudge(mark(0.4, 0), 'up', false, fit).y).toBe(0);
    // A Shift step bigger than the room left stops at the edge.
    expect(nudge(mark(0.04, 0.04), 'left', true, fit)).toEqual(mark(0, 0.04));
    expect(nudge(mark(0.04, 0.04), 'up', true, fit)).toEqual(mark(0.04, 0));
  });

  it('stops at the right edge, where the Mark touches it', () => {
    // A third wide: its left edge stops at two thirds.
    expect(nudge(mark(2 / 3, 0.4), 'right', false, fit).x).toBeCloseTo(2 / 3, 10);
    expect(nudge(mark(0.6, 0.4), 'right', true, fit).x).toBeCloseTo(2 / 3, 10);
  });

  it('stops at the bottom edge, which depends on the page and picture shapes', () => {
    // One sixth tall: its top edge stops at five sixths.
    expect(nudge(mark(0.4, 5 / 6), 'down', false, fit).y).toBeCloseTo(5 / 6, 10);
    expect(nudge(mark(0.4, 0.8), 'down', true, fit).y).toBeCloseTo(5 / 6, 10);
    // On a page 200 × 300 the same Mark is 66.7 × 22.2 points: 2/27 of the height.
    const tall = { markAspect: 3, pageAspect: 2 / 3 };
    expect(nudge(mark(0.4, 0.9), 'down', true, tall).y).toBeCloseTo(25 / 27, 10);
  });
});
