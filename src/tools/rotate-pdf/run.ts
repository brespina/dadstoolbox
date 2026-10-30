import { degrees, PDFDocument } from 'pdf-lib';
import type { ToolRun } from '../types';
import { turns, type Options } from './declaration';

/**
 * Turns every page of the PDF by the chosen amount, on top of any turn it already had.
 * The loaded file is saved again rather than copied page by page, so bookmarks, forms and
 * links stay.
 */
export const run: ToolRun<Options> = async (file, options) => {
  const doc = await PDFDocument.load(await file.arrayBuffer());
  for (const page of doc.getPages()) {
    page.setRotation(degrees(page.getRotation().angle + turns[options.turn]));
  }
  const bytes = await doc.save();
  return [{ blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }) }];
};
