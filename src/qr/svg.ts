// Draws a QR code as an SVG file: the same pieces (see shapes.ts) as the PNG, as vectors.
// The drawing is in squares ("modules"), so it stays sharp at any size. A logo is held
// inside the file as a data address, so the file stands alone.
import type { Part, RoundedSquare, Square } from './shapes';
import type { QrStyle } from './style';

/** A logo for the middle of an SVG code. */
export interface SvgLogo {
  /** The patch the logo sits on, in squares from the code's top left. */
  patch: Square;
  /** The patch's colour, as "#rrggbb". */
  patchColour: string;
  /** The logo's box, in squares from the code's top left. */
  box: Square;
  /** The logo itself, as a data address ("data:image/png;base64,..."). */
  href: string;
}

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
  logo?: SvgLogo;
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
export function svgText({ parts, border, total, pixels, style, logo }: SvgCode) {
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
    ...(logo ? logoElements(logo, border) : []),
  ];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg"` +
      // Design programs read only the older xlink:href that the logo uses.
      `${logo ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : ''}` +
      ` viewBox="0 0 ${total} ${total}" width="${pixels}" height="${pixels}"` +
      // Square pieces meet exactly, so crisp edges keep a renderer from blurring them.
      `${squareOnly ? ' shape-rendering="crispEdges"' : ''}>`,
    ...elements,
    '</svg>',
  ].join('\n');
}

/** The logo's patch, then the logo over it, fitted whole in its box and never stretched. */
function logoElements({ patch, patchColour, box, href }: SvgLogo, border: number) {
  const place = ({ x, y, size }: Square) =>
    `x="${num(x + border)}" y="${num(y + border)}" width="${num(size)}" height="${num(size)}"`;
  return [
    `<rect ${place(patch)} fill="${patchColour}"/>`,
    `<image ${place(box)} preserveAspectRatio="xMidYMid meet" xlink:href="${href}"/>`,
  ];
}

/** The code as an SVG file's Blob. */
export function svgBlob(code: SvgCode) {
  return new Blob([svgText(code)], { type: 'image/svg+xml' });
}
