// The one "can this PDF be signed" check, shared by the page editor and `run` so
// the two can't drift (ADR-0007).

import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, type PDFObject } from 'pdf-lib';
import { ToolFailure } from '../types';
import { tool } from './declaration';

const signatureType = PDFName.of('Sig');

/** What a dictionary or list holds at a key or place, or nothing if it holds something else. */
function look<T extends PDFObject>(
  where: PDFDict | PDFArray,
  at: PDFName | number,
  type: { prototype: T },
): T | undefined {
  try {
    return (where as PDFDict).lookupMaybe(at as PDFName, type as never) as T | undefined;
  } catch {
    // A damaged PDF may hold anything anywhere: it is just not a field.
    return undefined;
  }
}

/**
 * Whether a signature field holds a value: a seal that saving the PDF again would break.
 * Reads the AcroForm dictionary directly, never `getForm()` (it drops XFA data, ADR-0007).
 * A field's type passes down the field tree, so a widget under its parent takes the parent's.
 * Anything that doesn't read as a field is passed over.
 */
function isSigned(doc: PDFDocument): boolean {
  const form = look(doc.catalog, PDFName.of('AcroForm'), PDFDict);
  // A field that points back at one already seen would go round for ever.
  const seen = new Set<PDFRef>();
  const anyHolds = (list: PDFArray | undefined, inherited: PDFName | undefined): boolean =>
    !!list &&
    list.asArray().some((entry, i) => {
      if (entry instanceof PDFRef) {
        if (seen.has(entry)) return false;
        seen.add(entry);
      }
      const field = look(list, i, PDFDict);
      if (!field) return false;
      const type = look(field, PDFName.of('FT'), PDFName) ?? inherited;
      if (type === signatureType && look(field, PDFName.of('V'), PDFDict)) return true;
      return anyHolds(look(field, PDFName.of('Kids'), PDFArray), type);
    });
  return anyHolds(form && look(form, PDFName.of('Fields'), PDFArray), undefined);
}

/**
 * Opens a PDF to sign. Throws a ToolFailure with the plain reason when it can't be signed
 * here (it has a password, or was already signed digitally), and an ordinary error for a
 * file that isn't a PDF that opens.
 */
export async function openToSign(bytes: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  // pdf-lib's own EncryptedPDFError fails `instanceof`, so load anyway and ask. Its
  // Producer and dates stay as they were, so the rest of the PDF is unchanged.
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  // The password comes first: a file that is locked can't be read for signatures.
  if (doc.isEncrypted) throw new ToolFailure(tool.reasons.password!);
  if (isSigned(doc)) throw new ToolFailure(tool.reasons.digitallySigned!);
  return doc;
}
