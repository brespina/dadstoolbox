// Draws a QR code in a Style, shared by the QR code Tools: the one place a code is drawn.
import { create } from 'qrcode';
import { palettePng, type PaletteColour } from './png';
import { rgb, styleWarnings, type QrStyle } from './style';

/** The border around the code, in squares. Scanners need at least 4. */
const margin = 4;
/** Pictures are at least this many pixels wide, so they print sharply. */
const minimumWidth = 720;
/**
 * A see-through pixel. Its colour is white, so an app that ignores see-through shows
 * white, where the code still reads.
 */
const seeThrough: PaletteColour = [255, 255, 255, 0];

/** Thrown when the text is too long for one code. Each Tool turns it into its own reason. */
export class TooLongForCode extends Error {
  constructor() {
    super('The text is too long for one QR code');
    this.name = 'TooLongForCode';
  }
}

/** A drawn code, and the notes to show under it. */
export interface QrDrawing {
  /** A PNG of the code. */
  blob: Blob;
  /** Notes under the code, such as colours that may not scan. They never stop it. */
  warnings: string[];
}

/** A code that reads as `content`, drawn in `style`. */
export function drawQr(content: string, style: QrStyle): QrDrawing {
  let code;
  try {
    code = create(content, { errorCorrectionLevel: 'M' });
  } catch (error) {
    if (error instanceof Error && /too big/.test(error.message)) throw new TooLongForCode();
    throw error;
  }

  const { size, data } = code.modules;
  const total = size + margin * 2;
  const scale = Math.ceil(minimumWidth / total);
  const isDark = (row: number, col: number) => {
    const r = row - margin;
    const c = col - margin;
    return r >= 0 && c >= 0 && r < size && c < size && data[r * size + c] === 1;
  };
  const background: PaletteColour = style.noBackground ? seeThrough : [...rgb(style.background), 255];
  const palette = [background, [...rgb(style.code), 255] as const];
  const blob = palettePng(total * scale, palette, (x, y) =>
    isDark(Math.floor(y / scale), Math.floor(x / scale)) ? 1 : 0,
  );
  return { blob, warnings: styleWarnings(style) };
}
