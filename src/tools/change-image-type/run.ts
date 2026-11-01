import {
  buildTiff,
  isHeif,
  jpegWithDetails,
  pngWithDetails,
  readDetails,
  webpWithDetails,
} from '../../photos/exif';
import { ToolFailure, type ToolRun, type ToolRunContext } from '../types';
import { formatTypes, tool, type Options } from './declaration';
import { paintOnCanvas, paintSquaresOnCanvas } from './canvas';
import { iconSizes, makeIco } from './ico';

/** An image drawn the right way up and saved as `type`, with no photo details. */
export interface Painted {
  blob: Blob;
  width: number;
  height: number;
}
export type Paint = (file: File, type: string, context?: ToolRunContext) => Promise<Painted>;

/** The image in the middle of a see-through square of each size, saved as PNG. */
export type PaintSquares = (
  file: File,
  sizes: readonly number[],
  context?: ToolRunContext,
) => Promise<Painted[]>;

/** The Tool's job, with the drawing steps passed in so tests can stand in for the canvas. */
export function makeRun(
  paint: Paint,
  paintSquares: PaintSquares = paintSquaresOnCanvas,
): ToolRun<Options> {
  return async (file, options, context) => {
    const original = new Uint8Array(await file.arrayBuffer());
    const type = formatTypes[options.format];

    let painted: Painted | undefined;
    let squares: Painted[] = [];
    try {
      if (options.format === 'ico') squares = await paintSquares(file, iconSizes, context);
      else painted = await paint(file, type, context);
    } catch (error) {
      // Neither the browser nor the late-loaded decoder could open this iPhone photo.
      if (isHeif(original)) throw new ToolFailure(tool.reasons.heic!);
      throw error;
    }

    // An ICO holds no photo details.
    if (!painted) {
      const pictures = await Promise.all(
        squares.map(async ({ blob, width }) => ({
          size: width,
          png: new Uint8Array(await blob.arrayBuffer()),
        })),
      );
      return [{ blob: new Blob([makeIco(pictures)], { type }) }];
    }

    const tiff = buildTiff(readDetails(original), !options.removeLocation);
    const drawn = new Uint8Array(await painted.blob.arrayBuffer());
    const bytes =
      type === 'image/jpeg'
        ? jpegWithDetails(drawn, tiff)
        : type === 'image/png'
          ? pngWithDetails(drawn, tiff)
          : webpWithDetails(drawn, tiff, painted);
    return [{ blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type }) }];
  };
}

export const run = makeRun(paintOnCanvas);
