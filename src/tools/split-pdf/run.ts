import { PDFDocument } from 'pdf-lib';
import { ToolFailure, type ToolResult, type ToolRun } from '../types';
import { tool } from './declaration';

/** One PDF per page, named page1, page2, … */
export const run: ToolRun<typeof tool.defaultOptions> = async (file) => {
  // pdf-lib's own EncryptedPDFError fails `instanceof`, so load anyway and ask.
  const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  if (source.isEncrypted) throw new ToolFailure(tool.reasons.password!);

  const results: ToolResult[] = [];
  for (const index of source.getPageIndices()) {
    const page = await PDFDocument.create();
    const [copy] = await page.copyPages(source, [index]);
    page.addPage(copy);
    const bytes = await page.save();
    results.push({
      blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      detail: `page${index + 1}`,
    });
  }
  return results;
};
