import { describe, expect, it } from 'vitest';
import { placeOnPage, shownSize, turnOf, visibleBox, type PageBoxes } from './page-geometry';

// A page 400 × 300 whose visible box is 50..350 across and 20..220 up: 300 × 200.
const cropped: PageBoxes = { mediaBox: [0, 0, 400, 300], cropBox: [50, 20, 350, 220] };
// A Mark a tenth in from the left, a fifth down, half the page wide.
const mark = { x: 0.1, y: 0.2, width: 0.5 };

/** Where a picture twice as wide as it is high lands, for a page turned `rotate`. */
const placed = (rotate: number, page: PageBoxes = cropped) =>
  placeOnPage({ ...page, rotate }, mark, 2);

describe('the box a page shows', () => {
  it('is the crop box inside the media box', () => {
    expect(visibleBox([0, 0, 400, 300], [50, 20, 350, 220])).toEqual([50, 20, 350, 220]);
  });

  it('is the media box when there is no crop box', () => {
    expect(visibleBox([10, 10, 410, 310], undefined)).toEqual([10, 10, 410, 310]);
  });

  it('puts corners in order, for either box', () => {
    expect(visibleBox([400, 300, 0, 0], [350, 220, 50, 20])).toEqual([50, 20, 350, 220]);
  });

  it('keeps only the part of a crop box that is on the media box', () => {
    expect(visibleBox([0, 0, 400, 300], [-100, 100, 200, 500])).toEqual([0, 100, 200, 300]);
  });

  it('falls back to the media box for a crop box with nothing on it, or no area', () => {
    expect(visibleBox([0, 0, 400, 300], [500, 500, 600, 600])).toEqual([0, 0, 400, 300]);
    expect(visibleBox([0, 0, 400, 300], [50, 20, 50, 220])).toEqual([0, 0, 400, 300]);
  });

  it('is Letter when the media box is missing or has no area', () => {
    expect(visibleBox(undefined, undefined)).toEqual([0, 0, 612, 792]);
    expect(visibleBox([0, 0, 0, 300], undefined)).toEqual([0, 0, 612, 792]);
  });

  it('ignores a crop box that is not four numbers', () => {
    expect(visibleBox([0, 0, 400, 300], [1, 2, 3])).toEqual([0, 0, 400, 300]);
    expect(visibleBox([0, 0, 400, 300], [1, 2, 3, Number.NaN])).toEqual([0, 0, 400, 300]);
  });
});

describe("a page's turn", () => {
  it('is the Rotate value in whole quarter turns, kept from 0 to 270', () => {
    expect([0, 90, 180, 270].map(turnOf)).toEqual([0, 90, 180, 270]);
    expect([360, 450, -90, -180, -270, -360, 720].map(turnOf)).toEqual([0, 90, 270, 180, 90, 0, 0]);
  });

  it('is 0 when missing or not a quarter turn', () => {
    expect([undefined, 45, 100, Number.NaN].map(turnOf)).toEqual([0, 0, 0, 0]);
  });
});

describe('the page as shown', () => {
  it("has the visible box's size, swapped when the page is turned a quarter", () => {
    expect(shownSize({ ...cropped, rotate: 0 })).toEqual({ width: 300, height: 200 });
    expect(shownSize({ ...cropped, rotate: 90 })).toEqual({ width: 200, height: 300 });
    expect(shownSize({ ...cropped, rotate: 180 })).toEqual({ width: 300, height: 200 });
    expect(shownSize({ ...cropped, rotate: 270 })).toEqual({ width: 200, height: 300 });
  });
});

describe('where a Mark lands in the PDF', () => {
  // Each expectation is worked by hand. The page as shown is 300 × 200 (200 × 300 turned a
  // quarter); the Mark is half the page's width wide and half that high (a 2 : 1 picture).

  it('on an unturned page, offset by the crop box and measured up from the bottom', () => {
    // 150 × 75 points, top-left 30 across and 40 down: lower-left at 50 + 30, 220 − (40 + 75).
    expect(placed(0)).toEqual({ x: 80, y: 105, width: 150, height: 75, turn: 0 });
  });

  it('on a page turned 90, with the picture turned 90 to read upright', () => {
    // 100 × 50 points on a page 200 across and 300 down, top-left 20 across and 60 down, so
    // lower-left 20 across and 110 down. Across counts up the PDF and down counts across it:
    // 50 + 110 and 20 + 20.
    expect(placed(90)).toEqual({ x: 160, y: 40, width: 100, height: 50, turn: 90 });
  });

  it('on a page turned 180', () => {
    // Lower-left 30 across and 115 down: 350 − 30 and 20 + 115.
    expect(placed(180)).toEqual({ x: 320, y: 135, width: 150, height: 75, turn: 180 });
  });

  it('on a page turned 270', () => {
    // Lower-left 20 across and 110 down: 350 − 110 and 220 − 20.
    expect(placed(270)).toEqual({ x: 240, y: 200, width: 100, height: 50, turn: 270 });
  });

  it('on a page with no crop box, whose media box starts away from the corner', () => {
    const page: PageBoxes = { mediaBox: [10, 10, 410, 310] };
    // Page 400 × 300: the Mark is 200 × 100, top-left 40 across and 60 down, so its
    // lower-left is 40 across and 160 down: 10 + 40 and 310 − 160.
    expect(placed(0, page)).toEqual({ x: 50, y: 150, width: 200, height: 100, turn: 0 });
  });

  it('turns a Rotate that is negative, or past a full turn, the same way', () => {
    expect(placed(-90)).toEqual(placed(270));
    expect(placed(450)).toEqual(placed(90));
    expect(placed(45)).toEqual(placed(0));
  });

  it("follows the picture's shape for its height, and keeps the width", () => {
    const tall = placeOnPage({ ...cropped, rotate: 0 }, mark, 0.5);
    expect([tall.width, tall.height]).toEqual([150, 300]);
  });
});

describe('the four corners of the page', () => {
  /**
   * Where a PDF point is on the page as shown, as (across, down): worked the other way
   * from `placeOnPage`, by which corner of the visible box the page starts from and which
   * way across and down run, for each turn.
   */
  function shownAt(
    [x0, y0, x1, y1]: number[],
    turn: number,
    [x, y]: [number, number],
  ): [number, number] {
    if (turn === 90) return [y - y0, x - x0];
    if (turn === 180) return [x1 - x, y - y0];
    if (turn === 270) return [y1 - y, x1 - x];
    return [x - x0, y1 - y];
  }

  const pages: [string, PageBoxes][] = [
    ['cropped', cropped],
    ['away from the corner', { mediaBox: [10, 10, 410, 310] }],
  ];
  for (const [name, page] of pages) {
    for (const turn of [0, 90, 180, 270]) {
      it(`go back to where they were put, page ${name}, turned ${turn}`, () => {
        const box = visibleBox(page.mediaBox, page.cropBox);
        const { width: across, height: down } = shownSize({ ...page, rotate: turn });
        // A picture as wide and as high as the page, so its corners are the page's.
        const whole = placeOnPage(
          { ...page, rotate: turn },
          { x: 0, y: 0, width: 1 },
          across / down,
        );
        expect(whole.turn).toBe(turn);
        // The picture's own right and up, as directions in the PDF.
        const radians = (turn * Math.PI) / 180;
        const right = [Math.cos(radians), Math.sin(radians)] as const;
        const up = [-right[1], right[0]] as const;
        const corner = (a: number, b: number): [number, number] => [
          whole.x + right[0] * a * whole.width + up[0] * b * whole.height,
          whole.y + right[1] * a * whole.width + up[1] * b * whole.height,
        ];
        const rounded = ([a, b]: [number, number]) => [
          Math.round(a * 1e6) / 1e6 + 0,
          Math.round(b * 1e6) / 1e6 + 0,
        ];
        expect(rounded(shownAt(box, turn, corner(0, 0)))).toEqual([0, down]);
        expect(rounded(shownAt(box, turn, corner(1, 0)))).toEqual([across, down]);
        expect(rounded(shownAt(box, turn, corner(1, 1)))).toEqual([across, 0]);
        expect(rounded(shownAt(box, turn, corner(0, 1)))).toEqual([0, 0]);
      });
    }
  }
});
