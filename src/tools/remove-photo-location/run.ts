import { isHeif, isJpeg,jpegWithoutLocation } from '../../photos/exif';
import { ToolFailure, type ToolRun } from '../types';
import { tool } from './declaration';

/** A copy of the photo with its location taken out, and nothing else changed. */
export const run: ToolRun<typeof tool.defaultOptions> = async (file) => {
  const original = new Uint8Array(await file.arrayBuffer());
  // Told apart by their bytes, since a file's type can be missing or wrong.
  if (isHeif(original)) throw new ToolFailure(tool.reasons.heic!);
  if (!isJpeg(original)) throw new ToolFailure(tool.reasons.notCarried!);
  const bytes = jpegWithoutLocation(original);
  return [{ blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }) }];
};
