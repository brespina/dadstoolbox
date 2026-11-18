// The one "can this PDF be signed here" check, shared by the page editor and `run` so
// the two can't drift (ADR-0007). #110 adds a PDF that was signed digitally.

import { PDFDocument } from 'pdf-lib';
import { ToolFailure } from '../types';
import { tool } from './declaration';

/**
 * Opens a PDF to sign. Throws a ToolFailure with the plain reason when it can't be signed
 * here, and an ordinary error for a file that isn't a PDF that opens.
 */
export async function openToSign(bytes: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  // pdf-lib's own EncryptedPDFError fails `instanceof`, so load anyway and ask. Its
  // Producer and dates stay as they were, so the rest of the PDF is unchanged.
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  if (doc.isEncrypted) throw new ToolFailure(tool.reasons.password!);
  return doc;
}
