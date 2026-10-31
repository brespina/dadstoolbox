// Draws a QR code as an SVG file: the same pieces (see shapes.ts) as the PNG, as vectors.
// The drawing is in squares ("modules"), so it stays sharp at any size. The file is a list
// of elements, so a logo (#76) can add its own before the file is closed.
import type { Part, RoundedSquare } from './shapes';
import type { QrStyle } from './style';

export interface SvgCode {
  /** Every filled piece of the code, in squares from the code's top left. */
  parts: readonly Part[];
  /** The border around the code, in squares. */
  border: number;
  /** The width and height of the drawing in squares, border included. */
  total: number;
  /** The size the file states, in pixels. Browsers need one to show an SVG as a picture. */
  pixels: number;
  style: QrStyle;
}

/** A number for the file: three decimals at most, with no trailing zeros. */
const num = (value: number) => String(Math.round(value * 1000) / 1000);

/** The path of a rounded square (a circle when the radius is half its size), moved by `offset`. */
function squarePath({ x, y, size, radius }: RoundedSquare, offset: number) {
  const straight = size - radius * 2;
  // Each side, then the corner arc after it. A side with no length, or an arc with no
  // radius, is left out.
  const side = (command: 'h' | 'v', length: number) =>
    straight > 0 ? `${command}${num(length)}` : '';
  const arc = (dx: number, dy: number) =>
    radius > 0 ? `a${num(radius)} ${num(radius)} 0 0 1 ${num(dx)} ${num(dy)}` : '';
  return (
    `M${num(x + offset + radius)} ${num(y + offset)}` +
    side('h', straight) +
    arc(radius, radius) +
    side('v', straight) +
    arc(-radius, radius) +
    side('h', -straight) +
    arc(-radius, -radius) +
    side('v', -straight) +
    arc(radius, -radius) +
    'z'
  );
}

/**
 * The SVG text of a code. All the pieces are one path, so square dots that touch leave no
 * hairline between them, and rings are cut out by the even-odd rule, so a see-through
 * background shows through them.
 */
export function svgText({ parts, border, total, pixels, style }: SvgCode) {
  const path = parts
    .map(({ outer, hole }) => squarePath(outer, border) + (hole ? squarePath(hole, border) : ''))
    .join('');
  const squareOnly = style.dotShape === 'square' && style.cornerShape === 'square';
  const elements = [
    // See-through is no rectangle at all.
    ...(style.noBackground
      ? []
      : [`<rect width="${total}" height="${total}" fill="${style.background}"/>`]),
    `<path fill="${style.code}" fill-rule="evenodd" d="${path}"/>`,
  ];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${pixels}" height="${pixels}"` +
      // Square pieces meet exactly, so crisp edges keep a renderer from blurring them.
      `${squareOnly ? ' shape-rendering="crispEdges"' : ''}>`,
    ...elements,
    '</svg>',
  ].join('\n');
}

/** The code as an SVG file's Blob. */
export function svgBlob(code: SvgCode) {
  return new Blob([svgText(code)], { type: 'image/svg+xml' });
}
