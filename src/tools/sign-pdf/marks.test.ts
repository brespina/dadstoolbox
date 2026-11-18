import { describe, expect, it } from 'vitest';
import type { Mark } from './declaration';
import {
  actionFor,
  dragTo,
  heightOf,
  nudge,
  placeCentred,
  placeLowerMiddle,
  resize,
  smallest,
  startingWidth,
} from './marks';

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

describe('making a Mark smaller or bigger', () => {
  it('grows a tenth, about its centre', () => {
    const bigger = resize(mark(0.4, 0.4, 0.2), 'bigger', fit);
    expect(bigger.width).toBeCloseTo(0.22, 10);
    // The centre stays: 0.4 + 0.1 across; and down, a height of 0.2 × 1.5 ÷ 3 = 0.1.
    expect(bigger.x + bigger.width / 2).toBeCloseTo(0.5, 10);
    expect(bigger.y + heightOf(bigger, fit) / 2).toBeCloseTo(0.45, 10);
  });

  it('shrinks by the same tenth, so Bigger then Smaller comes back', () => {
    const start = mark(0.4, 0.4, 0.2);
    const back = resize(resize(start, 'bigger', fit), 'smaller', fit);
    expect(back.width).toBeCloseTo(0.2, 10);
    expect(back.x).toBeCloseTo(0.4, 10);
    expect(back.y).toBeCloseTo(0.4, 10);
  });

  it('changes only x, y and width', () => {
    const next = resize(mark(0.4, 0.4), 'smaller', fit);
    expect(Object.keys(next).sort()).toEqual(['kind', 'page', 'width', 'x', 'y']);
    expect(next.page).toBe(1);
  });

  it('stops at the smallest size, 5% of the page wide', () => {
    expect(smallest).toBe(0.05);
    expect(resize(mark(0.4, 0.4, 0.052), 'smaller', fit).width).toBe(0.05);
    const least = mark(0.4, 0.4, 0.05);
    expect(resize(least, 'smaller', fit)).toEqual(least);
  });

  it('stops at the largest size, the whole page wide', () => {
    expect(resize(mark(0.05, 0.4, 0.95), 'bigger', fit)).toMatchObject({ x: 0, width: 1 });
    const most = mark(0, 0.4, 1);
    expect(resize(most, 'bigger', fit)).toEqual(mark(0, 0.4, 1));
  });

  it('stops growing when the Mark would be taller than the page', () => {
    // A square picture on a page 300 × 200: it is as high as the page at 2/3 of its width.
    const square = { markAspect: 1, pageAspect: 1.5 };
    const grown = resize(mark(0.1, 0, 0.65), 'bigger', square);
    expect(grown.width).toBeCloseTo(2 / 3, 10);
    expect(heightOf(grown, square)).toBeCloseTo(1, 10);
  });

  it('pulls a Mark that grows past an edge back inside', () => {
    const right = resize(mark(0.7, 0.4, 0.3), 'bigger', fit);
    expect(right.width).toBeCloseTo(0.33, 10);
    expect(right.x + right.width).toBeCloseTo(1, 10);
    const bottom = resize(mark(0.4, 0.9, 0.6), 'bigger', fit);
    expect(bottom.y + heightOf(bottom, fit)).toBeLessThanOrEqual(1 + 1e-9);
    expect(bottom.y).toBeGreaterThan(0.5);
  });
});

describe('dragging a Mark', () => {
  // Grabbed at (0.5, 0.45) while the Mark's top-left was (0.4, 0.4): 0.1 and 0.05 in.
  const grab = { x: 0.1, y: 0.05 };

  it('keeps the grab point under the pointer', () => {
    const moved = dragTo(mark(0.4, 0.4), grab, { x: 0.6, y: 0.65 }, fit);
    expect(moved.x).toBeCloseTo(0.5, 10);
    expect(moved.y).toBeCloseTo(0.6, 10);
  });

  it('changes only x and y', () => {
    const moved = dragTo(mark(0.4, 0.4, 0.25), grab, { x: 0.6, y: 0.65 }, fit);
    expect(moved).toMatchObject({ kind: 'signature', page: 1, width: 0.25 });
  });

  it('stays inside the page when the pointer leaves it', () => {
    expect(dragTo(mark(0.4, 0.4), grab, { x: -0.5, y: -0.5 }, fit)).toEqual(mark(0, 0));
    const far = dragTo(mark(0.4, 0.4), grab, { x: 1.5, y: 1.5 }, fit);
    expect(far.x).toBeCloseTo(2 / 3, 10);
    expect(far.y).toBeCloseTo(5 / 6, 10);
  });
});

describe('placing a new Mark', () => {
  it('starts a Signature a third of the page wide', () => {
    expect(startingWidth('signature')).toBeCloseTo(1 / 3, 10);
  });

  it('puts a tapped Mark centred on the point', () => {
    const placed = placeCentred('signature', 2, { x: 0.5, y: 0.5 }, fit);
    expect(placed.kind).toBe('signature');
    expect(placed.page).toBe(2);
    expect(placed.width).toBeCloseTo(1 / 3, 10);
    // Its centre is the point: a sixth tall, so its top is 0.5 - 1/12.
    expect(placed.x).toBeCloseTo(1 / 3, 10);
    expect(placed.y).toBeCloseTo(0.5 - 1 / 12, 10);
  });

  it('keeps a Mark tapped near an edge inside the page', () => {
    expect(placeCentred('signature', 1, { x: 0, y: 0 }, fit)).toMatchObject({ x: 0, y: 0 });
    const corner = placeCentred('signature', 1, { x: 1, y: 1 }, fit);
    expect(corner.x).toBeCloseTo(2 / 3, 10);
    expect(corner.y).toBeCloseTo(5 / 6, 10);
  });

  it('puts "Add to page" in the lower middle', () => {
    const placed = placeLowerMiddle('signature', 3, fit);
    expect(placed.page).toBe(3);
    // Centred across; its middle four fifths of the way down.
    expect(placed.x + placed.width / 2).toBeCloseTo(0.5, 10);
    expect(placed.y + heightOf(placed, fit) / 2).toBeCloseTo(0.8, 10);
  });
});

describe('the keys that act on a chosen Mark', () => {
  const press = (key: string, more: Partial<KeyboardEvent> = {}) =>
    actionFor({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...more });

  it('moves with the arrow keys, by 10% with Shift', () => {
    expect(press('ArrowLeft')).toEqual({ do: 'move', direction: 'left', big: false });
    expect(press('ArrowDown', { shiftKey: true })).toEqual({
      do: 'move',
      direction: 'down',
      big: true,
    });
    expect(press('ArrowUp')).toEqual({ do: 'move', direction: 'up', big: false });
    expect(press('ArrowRight')).toEqual({ do: 'move', direction: 'right', big: false });
  });

  it('resizes with + and -, and = and _ which share their keys', () => {
    for (const key of ['+', '=']) expect(press(key)).toEqual({ do: 'size', way: 'bigger' });
    for (const key of ['-', '_']) expect(press(key)).toEqual({ do: 'size', way: 'smaller' });
    // The + key needs Shift on many keyboards.
    expect(press('+', { shiftKey: true })).toEqual({ do: 'size', way: 'bigger' });
  });

  it('removes with Delete or Backspace', () => {
    expect(press('Delete')).toEqual({ do: 'remove' });
    expect(press('Backspace')).toEqual({ do: 'remove' });
  });

  it('leaves every other key, and every shortcut, to the browser', () => {
    expect(press('a')).toBeUndefined();
    expect(press('Tab')).toBeUndefined();
    expect(press('ArrowLeft', { ctrlKey: true })).toBeUndefined();
    expect(press('ArrowLeft', { metaKey: true })).toBeUndefined();
    expect(press('-', { ctrlKey: true })).toBeUndefined();
    expect(press('Delete', { metaKey: true })).toBeUndefined();
  });
});
