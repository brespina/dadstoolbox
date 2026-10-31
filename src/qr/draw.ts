// Draws a QR code as a black-on-white PNG, shared by the QR code Tools.
import { create } from 'qrcode';
import { blackAndWhitePng } from './png';

/** The white border, in squares. Scanners need at least 4. */
const margin = 4;
/** Pictures are at least this many pixels wide, so they print sharply. */
const minimumWidth = 720;

/** Thrown when the text is too long for one code. Each Tool turns it into its own reason. */
export class TooLongForCode extends Error {
  constructor() {
    super('The text is too long for one QR code');
    this.name = 'TooLongForCode';
  }
}

/** One black-on-white PNG of a QR code that reads as `content`. */
export function qrPng(content: string): Blob {
  let code;
  try {
    code = create(content, { errorCorrectionLevel: 'M' });
  } catch (error) {
    if (error instanceof Error && /too big/.test(error.message)) throw new TooLongForCode();
    throw error;
  }

  const { size, data } = code.modules;
  const total = size + margin * 2;
  const isBlack = (row: number, col: number) => {
    const r = row - margin;
    const c = col - margin;
    return r >= 0 && c >= 0 && r < size && c < size && data[r * size + c] === 1;
  };
  return blackAndWhitePng(total, isBlack, Math.ceil(minimumWidth / total));
}
