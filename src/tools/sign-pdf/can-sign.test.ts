import { readFileSync } from 'node:fs';
import { PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { openToSign } from './can-sign';
import { tool } from './declaration';

const sample = (name: string) => new Uint8Array(readFileSync(new URL(name, import.meta.url)));

describe('the "can this PDF be signed" check', () => {
  it('opens a plain PDF, with its pages', async () => {
    const doc = await openToSign(sample('sample.pdf'));
    expect(doc.getPageCount()).toBe(3);
  });

  it('refuses a PDF with a password, with the shared reason', async () => {
    const failure = await openToSign(sample('sample-password.pdf')).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      'This PDF has a password. Remove it and try again.',
    );
  });

  it('throws an ordinary error for a file that is not a PDF', async () => {
    const failure = await openToSign(new TextEncoder().encode('hello')).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ToolFailure);
  });

  describe('a signature field', () => {
    /** A PDF whose one page has a signature field, holding a value or not, as pdf-lib builds it. */
    async function withSignatureField(
      filled: boolean,
      shape: 'plain' | 'in kids' | 'second' = 'plain',
    ) {
      const doc = await PDFDocument.create();
      const page = doc.addPage([300, 200]);
      const { context } = doc;
      const seal = context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        SubFilter: 'adbe.pkcs7.detached',
        ByteRange: [0, 0, 0, 0],
        Contents: PDFHexString.of('00'),
      });
      const value = filled ? { V: context.register(seal) } : {};
      const widget = (extra: object) =>
        context.register(
          context.obj({ Subtype: 'Widget', Rect: [10, 10, 100, 40], P: page.ref, ...extra }),
        );
      let fields;
      if (shape === 'in kids') {
        // The field type and the value sit on the parent, the widget below it has neither.
        const kid = widget({});
        const parent = context.register(
          context.obj({ FT: 'Sig', T: PDFString.of('Sig1'), Kids: [kid], ...value }),
        );
        fields = [parent];
      } else if (shape === 'second') {
        // A text field first, then the signature field.
        const text = widget({ FT: 'Tx', T: PDFString.of('Name'), V: PDFString.of('Ana') });
        fields = [text, widget({ FT: 'Sig', T: PDFString.of('Sig1'), ...value })];
      } else {
        fields = [widget({ FT: 'Sig', T: PDFString.of('Sig1'), ...value })];
      }
      page.node.set(PDFName.of('Annots'), context.obj(fields));
      doc.catalog.set(PDFName.of('AcroForm'), context.obj({ Fields: fields }));
      return doc.save({ updateFieldAppearances: false });
    }

    const refusal = (bytes: Uint8Array) => openToSign(bytes).catch((e: unknown) => e);

    it('that holds a value refuses the PDF, with the reason to ask for an unsigned copy', async () => {
      const failure = await refusal(await withSignatureField(true));
      expect(failure).toBeInstanceOf(ToolFailure);
      expect((failure as ToolFailure).reason).toBe(tool.reasons.digitallySigned);
      expect((failure as ToolFailure).reason).toMatch(/break that seal.*unsigned copy/);
    });

    it('that holds a value further down the field tree refuses it too', async () => {
      expect(await refusal(await withSignatureField(true, 'in kids'))).toBeInstanceOf(ToolFailure);
      expect(await refusal(await withSignatureField(true, 'second'))).toBeInstanceOf(ToolFailure);
    });

    it('that is empty opens the PDF', async () => {
      for (const shape of ['plain', 'in kids', 'second'] as const) {
        const doc = await openToSign(await withSignatureField(false, shape));
        expect(doc.getPageCount()).toBe(1);
      }
    });

    it('is not mistaken for another field that holds a value', async () => {
      // A filled text field is not a signature.
      const doc = await PDFDocument.create();
      const page = doc.addPage([300, 200]);
      const field = doc.getForm().createTextField('name');
      field.setText('Ana Diaz');
      field.addToPage(page, { x: 10, y: 10, width: 200, height: 30 });
      expect((await openToSign(await doc.save())).getPageCount()).toBe(1);
    });

    it('does not trip on a damaged field list', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([300, 200]);
      const { context } = doc;
      const loop = context.nextRef();
      context.assign(loop, context.obj({ FT: 'Sig', Kids: [loop] }));
      doc.catalog.set(
        PDFName.of('AcroForm'),
        context.obj({ Fields: [PDFName.of('nonsense'), 7, loop, context.obj({ FT: 'Sig' })] }),
      );
      expect((await openToSign(await doc.save())).getPageCount()).toBe(1);
    });
  });
});
