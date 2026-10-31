import { qrPng, TooLongForCode } from '../../qr/draw';
import { ToolFailure, type ToolTextRun } from '../types';
import { tool } from './declaration';

/** One black-on-white PNG of a QR code for the typed text. */
export const run: ToolTextRun<typeof tool.defaultOptions> = async (typed) => {
  try {
    return [{ blob: qrPng(typed) }];
  } catch (error) {
    if (error instanceof TooLongForCode) throw new ToolFailure(tool.reasons.tooLong!);
    throw error;
  }
};
