import { jpegWithoutLocation } from '../../photos/exif';
import { type ToolRun } from '../types';
import { tool } from './declaration';

/** A copy of the photo with its location taken out, and nothing else changed. */
export const run: ToolRun<typeof tool.defaultOptions> = async (file) => {
  const original = new Uint8Array(await file.arrayBuffer());
  const bytes = jpegWithoutLocation(original);
  return [{ blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }) }];
};
