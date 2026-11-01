// How a QR code looks (its Style, see GLOSSARY.md), shared by the QR code Tools. Plain
// data apart from the logo, a chosen file held in the page's memory only, so the Tools'
// declarations can use the plain Style (no logo) as their default.

import { text } from '../text';

/** How the dots, or the three big corner squares, are drawn. Square comes first. */
export const shapeNames = ['square', 'rounded', 'round'] as const;
export type ShapeName = (typeof shapeNames)[number];

/** What a code is saved as. PNG comes first. */
export const saveTypes = ['png', 'svg'] as const;
export type SaveType = (typeof saveTypes)[number];

export interface QrStyle {
  /** The code's colour, as "#rrggbb". */
  code: string;
  /** The background's colour, as "#rrggbb". Kept while `noBackground` is on. */
  background: string;
  /** True leaves the background see-through. */
  noBackground: boolean;
  /** The shape of the code's dots. */
  dotShape: ShapeName;
  /** The shape of the three big corner squares. */
  cornerShape: ShapeName;
  /** The kind of file the code is saved as. */
  saveAs: SaveType;
  /**
   * A picture (PNG, JPG, WebP or SVG) for the middle of the code, or null for none. It
   * never leaves the device.
   */
  logo: File | null;
}

/** Today's code: black on white. A closed Style section gives it. */
export const plainStyle: QrStyle = {
  code: '#000000',
  background: '#ffffff',
  noBackground: false,
  dotShape: 'square',
  cornerShape: 'square',
  saveAs: 'png',
  logo: null,
};

/** What a code with no background is meant to sit on. */
const paper = '#ffffff';

/** Below this contrast between code and background, many phone cameras struggle. */
const leastContrast = 3;

/** A "#rrggbb" colour's red, green and blue, each 0 to 255. */
export function rgb(colour: string): [number, number, number] {
  const value = Number.parseInt(colour.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** A colour's relative luminance, from 0 (black) to 1 (white), as WCAG measures it. */
function luminance(colour: string) {
  const [r, g, b] = rgb(colour).map((part) => {
    const c = part / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/**
 * The notes shown under a code drawn in this Style. They never stop the code. The code
 * must be darker than its background, with enough contrast. A code with no background
 * is checked against white, where the note says to put it.
 */
export function styleWarnings(style: QrStyle): string[] {
  const code = luminance(style.code);
  const background = luminance(style.noBackground ? paper : style.background);
  // Below 1 when the code is lighter than its background.
  const contrast = (background + 0.05) / (code + 0.05);
  return [
    ...(contrast < leastContrast ? [text.qr.colourWarning] : []),
    ...(style.noBackground ? [text.qr.noBackgroundNote] : []),
  ];
}
