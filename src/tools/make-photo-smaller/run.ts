import { buildTiff, isHeif, jpegWithDetails, readDetails } from '../../photos/exif';
import { ToolFailure, type ToolRun } from '../types';
import { lowerQuality, sizes, tool, type Options } from './declaration';
import { shrinkOnCanvas } from './canvas';

/** How small to make a photo: its longest side in pixels and the JPG quality (0 to 1). */
export interface How {
  longestSide: number;
  quality: number;
}
/** A photo drawn the right way up, no bigger than `how` says, saved as a JPG with no details. */
export type Shrink = (file: File, how: How) => Promise<Blob>;

/** The Tool's job, with the drawing step passed in so tests can stand in for the canvas. */
export function makeRun(shrink: Shrink): ToolRun<Options> {
  return async (file, options) => {
    const original = new Uint8Array(await file.arrayBuffer());
    const tiff = buildTiff(readDetails(original), !options.removeLocation);
    const how = sizes[options.size];
    const shrunk = async (quality: number) => {
      const drawn = await shrink(file, { ...how, quality });
      return jpegWithDetails(new Uint8Array(await drawn.arrayBuffer()), tiff);
    };

    let bytes: Uint8Array;
    try {
      bytes = await shrunk(how.quality);
    } catch (error) {
      // Only some browsers can open an iPhone photo (HEIC) themselves.
      if (isHeif(original)) throw new ToolFailure(tool.reasons.heic!);
      throw error;
    }
    // An already small photo can come out bigger, so try once more at a lower quality.
    if (bytes.length >= file.size && how.quality > lowerQuality) {
      const lower = await shrunk(lowerQuality);
      if (lower.length < bytes.length) bytes = lower;
    }
    return [
      {
        blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }),
        detail: 'small',
      },
    ];
  };
}

export const run = makeRun(shrinkOnCanvas);
