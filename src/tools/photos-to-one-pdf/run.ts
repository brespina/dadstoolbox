import { PDFDocument, PageSizes } from 'pdf-lib';
import { isHeif } from '../../photos/exif';
import { shrinkOnCanvas, type Shrink } from '../../photos/shrink';
import { fillReason, ToolFailure, type ToolRunTogether } from '../types';
import { tool } from './declaration';

/**
 * How each photo is drawn before it goes in: about 300 dots an inch on a Letter page, so a
 * receipt stays readable. Drawing it afresh also leaves its location behind.
 */
const how = { longestSide: 3000, quality: 0.9 };
/** The space around each photo, in points: half an inch. */
const margin = 36;

/** The Tool's job, with the drawing step passed in so tests can stand in for the canvas. */
export function makeRun(draw: Shrink): ToolRunTogether<typeof tool.defaultOptions> {
  return async (files, _options, context) => {
    const pdf = await PDFDocument.create();
    for (const file of files) {
      const drawn = await draw(file, how, context).catch(async (error: unknown) => {
        // Neither the browser nor the late-loaded decoder could open this iPhone photo.
        if (isHeif(new Uint8Array(await file.arrayBuffer()))) {
          throw new ToolFailure(fillReason(tool.reasons.heic!, { name: file.name }));
        }
        throw error;
      });
      // The drawn photo is already the right way up, so its own size says which way it faces.
      const image = await pdf.embedJpg(new Uint8Array(await drawn.arrayBuffer()));
      const [short, long] = PageSizes.Letter;
      const [width, height] = image.width > image.height ? [long, short] : [short, long];
      const page = pdf.addPage([width, height]);
      const scale = Math.min(
        (width - 2 * margin) / image.width,
        (height - 2 * margin) / image.height,
      );
      page.drawImage(image, {
        x: (width - image.width * scale) / 2,
        y: (height - image.height * scale) / 2,
        width: image.width * scale,
        height: image.height * scale,
      });
    }
    const bytes = await pdf.save();
    return [{ blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }) }];
  };
}

export const run = makeRun(shrinkOnCanvas);
