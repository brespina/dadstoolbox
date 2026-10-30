import { create } from 'qrcode';
import { ToolFailure, type ToolTextRun } from '../types';
import { tool } from './declaration';
import { blackAndWhitePng } from './png';

/** The white border, in squares. Scanners need at least 4. */
const margin = 4;
/** Pictures are at least this many pixels wide, so they print sharply. */
const minimumWidth = 720;

/** One black-on-white PNG of a QR code for the typed text. */
export const run: ToolTextRun<typeof tool.defaultOptions> = async (typed) => {
  let code;
  try {
    code = create(typed, { errorCorrectionLevel: 'M' });
  } catch (error) {
    if (error instanceof Error && /too big/.test(error.message)) {
      throw new ToolFailure(tool.reasons.tooLong!);
    }
    throw error;
  }

  const { size, data } = code.modules;
  const total = size + margin * 2;
  const isBlack = (row: number, col: number) => {
    const r = row - margin;
    const c = col - margin;
    return r >= 0 && c >= 0 && r < size && c < size && data[r * size + c] === 1;
  };
  return [{ blob: blackAndWhitePng(total, isBlack, Math.ceil(minimumWidth / total)) }];
};
