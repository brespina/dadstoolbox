import { readFileSync } from 'node:fs';
import { degrees, PDFDocument, PDFName, PDFNumber, type PDFPage } from 'pdf-lib';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { openToSign } from './can-sign';
import { inks, signatureFont, tool, type Mark, type Options } from './declaration';
import { makeRun } from './run';
import type { PaintMark } from './paint';
import { picturesOn } from './pictures-on';

const sample = (name: string) =>
  new File([readFileSync(new URL(name, import.meta.url))], name, { type: 'application/pdf' });

const asFile = (bytes: Uint8Array, name = 'made.pdf') =>
  new File([bytes as Uint8Array<ArrayBuffer>], name, { type: 'application/pdf' });

const drawn: Options['signature'] = {
  kind: 'drawn',
  strokes: [
    [
      [0.1, 0.5],
      [0.9, 0.5],
    ],
  ],
};

const signed = (marks: Mark[]): Options => ({ ...tool.defaultOptions, signature: drawn, marks });

/**
 * A stand-in for the browser's painting: every picture is twice as wide as it is high,
 * and each request is noted so the test can check what was asked for.
 */
function standIn() {
  const asked: {
    mark: Mark;
    ink: string;
    signature: Options['signature'];
    width: number;
    height: number;
  }[] = [];
  const paint: PaintMark = async (mark, options) => ({
    shape: 2,
    paint: async (width, height) => {
      asked.push({ mark, ink: options.ink, signature: options.signature, width, height });
      return new Uint8Array(PNG.sync.write(new PNG({ width, height })));
    },
  });
  return { paint, asked };
}

/** An upright picture's box, near enough these points. */
const near = (box: { x: number; y: number; width: number; height: number }) => ({
  ...Object.fromEntries(Object.entries(box).map(([k, v]) => [k, expect.closeTo(v, 3)])),
  turn: 0,
});

const words = (text: string, page = 1): Mark => ({
  kind: 'text',
  text,
  page,
  x: 0.1,
  y: 0.2,
  width: 0.5,
});

describe('Sign a PDF', () => {
  it('saves one PDF, named "signed", with the same pages and the picture where it was tapped', async () => {
    const { paint } = standIn();
    // sample.pdf has 3 pages, each 300 × 200 points.
    const mark: Mark = { kind: 'signature', page: 2, x: 0.1, y: 0.2, width: 0.5 };
    const results = await makeRun(paint)(sample('sample.pdf'), signed([mark]));

    expect(results).toHaveLength(1);
    expect(results[0]!.detail).toBe('signed');
    expect(results[0]!.blob.type).toBe('application/pdf');
    const doc = await PDFDocument.load(await results[0]!.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(3);
    expect(picturesOn(doc.getPage(0))).toEqual([]);
    expect(picturesOn(doc.getPage(2))).toEqual([]);
    // 150 wide (half of 300) and so 75 high; its top-left corner 30 in and 40 down,
    // and PDF points count up from the bottom.
    expect(picturesOn(doc.getPage(1))).toEqual([near({ x: 30, y: 85, width: 150, height: 75 })]);
  });

  it('keeps a Mark inside its page when its picture is taller than when it was placed', async () => {
    const { paint } = standIn();
    // 150 × 75 points with the stand-in's shape: from 0.9 down it would run off the bottom.
    const mark: Mark = { kind: 'signature', page: 1, x: 0.1, y: 0.9, width: 0.5 };
    const results = await makeRun(paint)(sample('sample.pdf'), signed([mark]));
    const doc = await PDFDocument.load(await results[0]!.blob.arrayBuffer());
    expect(picturesOn(doc.getPage(0))).toEqual([near({ x: 30, y: 0, width: 150, height: 75 })]);
  });

  describe('on turned and cropped pages', () => {
    // A page 400 × 300 whose visible box is 50..350 across and 20..220 up, turned as asked.
    // The Mark is a tenth in, a fifth down and half the page's width, on a 2 : 1 picture.
    const mark: Mark = { kind: 'signature', page: 1, x: 0.1, y: 0.2, width: 0.5 };
    const made = async (build: (doc: PDFDocument, page: PDFPage) => void) => {
      const source = await PDFDocument.create();
      build(source, source.addPage([400, 300]));
      const { paint, asked } = standIn();
      const [result] = await makeRun(paint)(asFile(await source.save()), signed([mark]));
      const doc = await PDFDocument.load(await result!.blob.arrayBuffer());
      return { page: doc.getPage(0), asked };
    };
    const crop = (page: PDFPage) => page.setCropBox(50, 20, 300, 200);

    // The box each picture covers in the saved PDF, worked by hand (page-geometry.test.ts).
    it.each([
      [0, { x: 80, y: 105, width: 150, height: 75 }],
      [90, { x: 110, y: 40, width: 50, height: 100 }],
      [180, { x: 170, y: 60, width: 150, height: 75 }],
      [270, { x: 240, y: 100, width: 50, height: 100 }],
    ])('puts a Mark where it was placed on a cropped page turned %i', async (turn, box) => {
      const { page } = await made((_, page) => {
        crop(page);
        page.setRotation(degrees(turn));
      });
      expect(picturesOn(page)).toEqual([{ ...near(box), turn }]);
      // The page's own turn is untouched.
      expect(page.getRotation().angle).toBe(turn);
    });

    it('keeps the picture as wide as it is on the page, whatever the turn', async () => {
      const { asked } = await made((_, page) => {
        crop(page);
        page.setRotation(degrees(90));
      });
      // 100 × 50 points is 1 7/18 × 25/36 inches: 417 × 208 dots, the same as on an unturned page.
      expect(asked.map(({ width, height }) => [width, height])).toEqual([[417, 208]]);
    });

    it('follows a turn the pages inherit from the page tree', async () => {
      const { page } = await made((doc, page) => {
        crop(page);
        doc.catalog.Pages().set(PDFName.of('Rotate'), PDFNumber.of(90));
      });
      expect(picturesOn(page)).toEqual([
        { ...near({ x: 110, y: 40, width: 50, height: 100 }), turn: 90 },
      ]);
    });

    it('treats a page with no media box as Letter, as the page viewer does', async () => {
      const { page } = await made((_, page) => page.node.delete(PDFName.of('MediaBox')));
      // Letter is 612 × 792: the picture is 306 × 153, lower-left 61.2 across, 158.4 + 153 down.
      expect(picturesOn(page)).toEqual([near({ x: 61.2, y: 480.6, width: 306, height: 153 })]);
    });

    it('follows a visible box that starts away from the corner, with no crop box', async () => {
      const { page } = await made((_, page) => page.setMediaBox(10, 10, 400, 300));
      // Page 400 × 300 from 10, 10: the picture is 200 × 100, lower-left 40 across, 160 down.
      expect(picturesOn(page)).toEqual([near({ x: 50, y: 150, width: 200, height: 100 })]);
    });
  });

  it('paints each Mark at 300 dots an inch of its size on the page, in the ink', async () => {
    const { paint, asked } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0, y: 0, width: 0.5 };
    await makeRun(paint)(sample('sample.pdf'), signed([mark]));
    // 150 × 75 points is 2 1/12 × 1 1/24 inches.
    expect(asked).toEqual([{ mark, ink: 'black', signature: drawn, width: 625, height: 313 }]);
  });

  it('paints no side longer than 2000 pixels', async () => {
    const big = await PDFDocument.create();
    big.addPage([1000, 1000]);
    const { paint, asked } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0, y: 0, width: 1 };
    await makeRun(paint)(asFile(await big.save()), signed([mark]));
    expect(asked.map(({ width, height }) => [width, height])).toEqual([[2000, 1000]]);
  });

  it('paints a very small Mark at least a pixel each way', async () => {
    const { paint, asked } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0, y: 0, width: 0.0001 };
    await makeRun(paint)(sample('sample.pdf'), signed([mark]));
    expect(asked.map(({ width, height }) => [width, height])).toEqual([[1, 1]]);
  });

  it('keeps what is typed in a form field', async () => {
    const form = await PDFDocument.create();
    const page = form.addPage([300, 200]);
    const field = form.getForm().createTextField('name');
    field.setText('Ana Diaz');
    field.addToPage(page, { x: 10, y: 10, width: 200, height: 30 });
    const { paint } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0.5, y: 0.5, width: 0.3 };
    const [result] = await makeRun(paint)(asFile(await form.save()), signed([mark]));

    const doc = await PDFDocument.load(await result!.blob.arrayBuffer());
    expect(doc.getForm().getTextField('name').getText()).toBe('Ana Diaz');
    expect(picturesOn(doc.getPage(0))).toHaveLength(1);
  });

  it('fails a PDF with a password with the shared reason', async () => {
    const { paint } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0, y: 0, width: 0.3 };
    const failure = await makeRun(paint)(sample('sample-password.pdf'), signed([mark])).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(tool.reasons.password);
  });

  it('fails a PDF that was already signed digitally, with the reason to ask for an unsigned copy', async () => {
    const { paint, asked } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0, y: 0, width: 0.3 };
    const failure = await makeRun(paint)(sample('sample-signed.pdf'), signed([mark])).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(tool.reasons.digitallySigned);
    expect(asked).toEqual([]);
  });

  it('signs a PDF whose signature field is empty, leaving the field as it was', async () => {
    const { paint } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0.1, y: 0.2, width: 0.5 };
    const [result] = await makeRun(paint)(sample('sample-signature-field.pdf'), signed([mark]));
    const doc = await PDFDocument.load(await result!.blob.arrayBuffer());
    expect(picturesOn(doc.getPage(0))).toHaveLength(1);
    // Still a signature field, still empty: the same PDF would still be signable.
    expect(await openToSign(await result!.blob.arrayBuffer())).toBeDefined();
  });

  it('throws an ordinary error for a file that is not a PDF', async () => {
    const { paint } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0, y: 0, width: 0.3 };
    const notPdf = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });
    const failure = await makeRun(paint)(notPdf, signed([mark])).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ToolFailure);
  });

  describe('a Text Mark', () => {
    it('lands as a picture on its page, and the painter is asked for its words', async () => {
      const { paint, asked } = standIn();
      const [result] = await makeRun(paint)(sample('sample.pdf'), signed([words('Ana Diaz', 2)]));
      const doc = await PDFDocument.load(await result!.blob.arrayBuffer());
      expect(picturesOn(doc.getPage(0))).toEqual([]);
      expect(picturesOn(doc.getPage(1))).toEqual([near({ x: 30, y: 85, width: 150, height: 75 })]);
      expect(asked.map(({ mark }) => mark)).toEqual([words('Ana Diaz', 2)]);
    });

    it.each(['サイン', 'توقيع', 'שלום', ' Ana  Diaz ', '😀 x'])(
      'gives words in any script to the painter unchanged: %j',
      async (text) => {
        const { paint, asked } = standIn();
        await makeRun(paint)(sample('sample.pdf'), signed([words(text)]));
        expect(asked.map(({ mark }) => (mark.kind === 'text' ? mark.text : null))).toEqual([text]);
      },
    );

    it('leaves out a Text Mark with no words, or only spaces, and keeps the rest', async () => {
      const { paint, asked } = standIn();
      const marks = [words(''), words('   '), words('Ana'), words('\t\n')];
      const [result] = await makeRun(paint)(sample('sample.pdf'), signed(marks));
      const doc = await PDFDocument.load(await result!.blob.arrayBuffer());
      expect(picturesOn(doc.getPage(0))).toHaveLength(1);
      expect(asked).toHaveLength(1);
    });

    it('is painted with the same ink as the Signature', async () => {
      const { paint, asked } = standIn();
      await makeRun(paint)(sample('sample.pdf'), signed([words('Ana')]));
      expect(asked.map(({ ink }) => ink)).toEqual(['black']);
    });
  });

  describe('a typed Signature', () => {
    const typed = (words: string): Options['signature'] => ({
      kind: 'typed',
      words,
      font: signatureFont,
    });
    const mark: Mark = { kind: 'signature', page: 1, x: 0.1, y: 0.2, width: 0.5 };
    const typedOptions = (words: string, ink: Options['ink'] = 'black'): Options => ({
      ...tool.defaultOptions,
      signature: typed(words),
      ink,
      marks: [mark],
    });

    it('is Dancing Script', () => {
      expect(signatureFont).toBe('Dancing Script');
    });

    it('lands as a picture on its page, and the painter is given the words and the font', async () => {
      const { paint, asked } = standIn();
      const [result] = await makeRun(paint)(sample('sample.pdf'), typedOptions('Ada Lovelace'));
      const doc = await PDFDocument.load(await result!.blob.arrayBuffer());
      expect(picturesOn(doc.getPage(0))).toHaveLength(1);
      expect(asked.map((one) => one.signature)).toEqual([
        { kind: 'typed', words: 'Ada Lovelace', font: 'Dancing Script' },
      ]);
    });

    it.each(['サイン', 'توقيع', 'Zoë Łukasz', ' Ana  Diaz ', '😀 x'])(
      'gives words in any script to the painter unchanged: %j',
      async (words) => {
        const { paint, asked } = standIn();
        await makeRun(paint)(sample('sample.pdf'), typedOptions(words));
        expect(asked.map((one) => one.signature)).toEqual([typed(words)]);
      },
    );
  });

  describe('ink', () => {
    it('is black unless the person chooses blue', () => {
      expect(tool.defaultOptions.ink).toBe('black');
      expect(Object.keys(inks)).toEqual(['black', 'blue']);
    });

    it('reaches the painter for every Mark: a drawn Signature, a typed one and Text', async () => {
      const { paint, asked } = standIn();
      const options = (signature: Options['signature'], marks: Mark[]): Options => ({
        ...tool.defaultOptions,
        signature,
        ink: 'blue',
        marks,
      });
      const sign: Mark = { kind: 'signature', page: 1, x: 0.1, y: 0.2, width: 0.3 };
      await makeRun(paint)(sample('sample.pdf'), options(drawn, [sign, words('Ana')]));
      await makeRun(paint)(
        sample('sample.pdf'),
        options({ kind: 'typed', words: 'Ana', font: signatureFont }, [sign]),
      );
      expect(asked.map(({ ink }) => ink)).toEqual(['blue', 'blue', 'blue']);
    });

    it('has a blue that differs from black', () => {
      expect(inks.blue).not.toBe(inks.black);
    });
  });

  describe('what start waits for', () => {
    const problem = (marks: Mark[], signature: Options['signature'] = drawn) =>
      tool.optionsProblem({ ...tool.defaultOptions, signature, marks });
    const none: Options['signature'] = tool.defaultOptions.signature;
    const mark: Mark = { kind: 'signature', page: 1, x: 0, y: 0, width: 0.3 };

    it('asks for a signature or some text when nothing is placed', () => {
      expect(problem([])).toBe('Put your signature or some text on a page first.');
      expect(problem([])).toBe(tool.notes.nothingPlaced);
    });

    it('counts a Text Mark with no words, or only spaces, as nothing placed', () => {
      expect(problem([words('')])).toBe(tool.notes.nothingPlaced);
      expect(problem([words('  ')])).toBe(tool.notes.nothingPlaced);
    });

    it('is satisfied by Text alone, with no Signature drawn', () => {
      expect(problem([words('Ana')], none)).toBeUndefined();
    });

    it('still wants a Signature for a Signature Mark, even beside Text', () => {
      expect(problem([mark, words('Ana')], none)).toBe(tool.notes.noSignature);
      expect(problem([mark, words('Ana')])).toBeUndefined();
    });

    it('asks to draw or type a signature when a Signature Mark has none', () => {
      expect(problem([mark], none)).toBe('Draw or type your signature first.');
    });

    it('is satisfied by typed words, and wants them when they are only spaces', () => {
      const typed = (words: string): Options['signature'] => ({
        kind: 'typed',
        words,
        font: signatureFont,
      });
      expect(problem([mark], typed('Ada'))).toBeUndefined();
      expect(problem([mark], typed('   '))).toBe(tool.notes.noSignature);
      expect(problem([mark], typed(''))).toBe(tool.notes.noSignature);
    });

    it('does not throw for a Mark that has no words at all', () => {
      const bare = { kind: 'text', page: 1, x: 0, y: 0, width: 0.3 } as unknown as Mark;
      expect(problem([bare])).toBe(tool.notes.nothingPlaced);
    });
  });
});
