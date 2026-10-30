import { PDFDocument } from 'pdf-lib';
import { fillReason, ToolFailure, type ToolRunTogether } from '../types';
import { tool } from './declaration';

/** One PDF with every page of every file, in the order given. */
export const run: ToolRunTogether<typeof tool.defaultOptions> = async (files) => {
  const combined = await PDFDocument.create();
  for (const file of files) {
    // pdf-lib's own EncryptedPDFError fails `instanceof`, so load anyway and ask.
    const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    if (source.isEncrypted) {
      throw new ToolFailure(fillReason(tool.reasons.password!, { name: file.name }));
    }
    const pages = await combined.copyPages(source, source.getPageIndices());
    for (const page of pages) combined.addPage(page);
  }
  const bytes = await combined.save();
  return [{ blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }) }];
};
