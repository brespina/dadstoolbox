import { degrees, PDFDocument } from 'pdf-lib';
import { ToolFailure, type ToolRun } from '../types';
import { tool, turns, type Options } from './declaration';

/**
 * Turns every page of the PDF by the chosen amount, on top of any turn it already had.
 * The loaded file is saved again rather than copied page by page, so bookmarks, forms and
 * links stay.
 */
export const run: ToolRun<Options> = async (file, options) => {
  // pdf-lib's own EncryptedPDFError fails `instanceof`, so load anyway and ask.
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  if (doc.isEncrypted) throw new ToolFailure(tool.reasons.password!);
  for (const page of doc.getPages()) {
    // Odd files may already hold a turn below 0 or past 360, so bring it back to 0–270.
    const angle = (((page.getRotation().angle + turns[options.turn]) % 360) + 360) % 360;
    page.setRotation(degrees(angle));
  }
  const bytes = await doc.save();
  return [{ blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }) }];
};
