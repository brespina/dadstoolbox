import { drawQr, TooLongForCode } from '../../qr/draw';
import { ToolFailure, type ToolTextRun } from '../types';
import { tool } from './declaration';

/** One PNG of a QR code for the typed text, in the chosen Style. */
export const run: ToolTextRun<typeof tool.defaultOptions> = async (typed, options) => {
  try {
    return [drawQr(typed, options.style)];
  } catch (error) {
    if (error instanceof TooLongForCode) throw new ToolFailure(tool.reasons.tooLong!);
    throw error;
  }
};
