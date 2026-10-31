// The geometry of a QR code's shapes, in squares ("modules"), shared by every way of drawing
// a code: the PNG, the SVG and a logo's gap (#76) later. Nothing here knows
// about pixels or colours, so every drawing gets the same shapes.
import type { ShapeName } from './style';

/** A square with rounded corners; a radius of half its size is a circle. */
export interface RoundedSquare {
  x: number;
  y: number;
  size: number;
  radius: number;
}

/** One filled piece of the code: a square, or a ring when it has a hole. */
export interface Part {
  outer: RoundedSquare;
  /** Cut out of the outer square, which leaves a ring. */
  hole?: RoundedSquare;
}

/** A dot's corner radius, in squares: 0.5 makes a circle. */
const dotRadius: Record<ShapeName, number> = { square: 0, rounded: 0.3, round: 0.5 };

/**
 * The corner radius of a big corner square's outer ring, its hole and its centre, in
 * squares. The rounded and round rings keep one thickness all the way round.
 */
const cornerRadius: Record<ShapeName, { outer: number; hole: number; centre: number }> = {
  square: { outer: 0, hole: 0, centre: 0 },
  rounded: { outer: 2, hole: 1, centre: 1 },
  round: { outer: 3.5, hole: 2.5, centre: 1.5 },
};

/** The big corner squares are this many squares wide. */
const cornerSize = 7;

/** The top left of each big corner square, as [row, column]. */
function cornerStarts(size: number): [number, number][] {
  return [
    [0, 0],
    [0, size - cornerSize],
    [size - cornerSize, 0],
  ];
}

/** True when the square at this row and column belongs to a big corner square. */
function inCorner(size: number, row: number, col: number) {
  return cornerStarts(size).some(
    ([r, c]) => row >= r && row < r + cornerSize && col >= c && col < c + cornerSize,
  );
}

/** The pieces of one big corner square: its ring, and the centre inside it. */
function cornerParts(row: number, col: number, shape: ShapeName): Part[] {
  const radius = cornerRadius[shape];
  return [
    {
      outer: { x: col, y: row, size: cornerSize, radius: radius.outer },
      hole: { x: col + 1, y: row + 1, size: cornerSize - 2, radius: radius.hole },
    },
    { outer: { x: col + 2, y: row + 2, size: cornerSize - 4, radius: radius.centre } },
  ];
}

/**
 * Every filled piece of a code `size` squares wide, in squares from its top left (the
 * border is the drawing's to add). `isDark(row, col)` says which squares are dark; the three
 * big corner squares are always drawn whole, in the corner shape, and every other dark
 * square is a dot in the dot shape. A caller can leave dots out (for a logo) by saying
 * they are not dark.
 */
export function codeParts(
  size: number,
  isDark: (row: number, col: number) => boolean,
  dotShape: ShapeName,
  cornerShape: ShapeName,
): Part[] {
  const parts = cornerStarts(size).flatMap(([row, col]) => cornerParts(row, col, cornerShape));
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (inCorner(size, row, col) || !isDark(row, col)) continue;
      parts.push({ outer: { x: col, y: row, size: 1, radius: dotRadius[dotShape] } });
    }
  }
  return parts;
}
