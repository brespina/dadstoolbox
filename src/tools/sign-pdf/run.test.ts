import { readFileSync } from 'node:fs';
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, type PDFPage } from 'pdf-lib';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { tool, type Mark, type Options } from './declaration';
import { makeRun } from './run';
import type { PaintMark } from './paint';

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
  const asked: { mark: Mark; ink: string; width: number; height: number }[] = [];
  const paint: PaintMark = async (mark, options) => ({
    shape: 2,
    paint: async (width, height) => {
      asked.push({ mark, ink: options.ink, width, height });
      return new Uint8Array(PNG.sync.write(new PNG({ width, height })));
    },
  });
  return { paint, asked };
}

/** Where each picture is drawn on a page, in PDF points: its lower-left corner and size. */
function picturesOn(page: PDFPage) {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray() : [contents!];
  const code = streams
    .map((ref) => page.doc.context.lookup(ref) as PDFRawStream)
    .map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode()))
    .join('\n');
  // Follow the drawing state through q, Q and cm, and note it at each Do.
  type Matrix = [number, number, number, number, number, number];
  const times = ([a, b, c, d, e, f]: Matrix, [A, B, C, D, E, F]: Matrix): Matrix => [
    a * A + b * C,
    a * B + b * D,
    c * A + d * C,
    c * B + d * D,
    e * A + f * C + E,
    e * B + f * D + F,
  ];
  let now: Matrix = [1, 0, 0, 1, 0, 0];
  const saved: Matrix[] = [];
  const numbers: number[] = [];
  const found: { x: number; y: number; width: number; height: number }[] = [];
  for (const token of code.split(/\s+/)) {
    if (/^-?[\d.]+$/.test(token)) numbers.push(Number(token));
    else {
      if (token === 'q') saved.push(now);
      if (token === 'Q') now = saved.pop()!;
      if (token === 'cm') now = times(numbers.slice(-6) as Matrix, now);
      if (token === 'Do') {
        const [a, , , d, e, f] = now;
        found.push({ x: e, y: f, width: a, height: d });
      }
      numbers.length = 0;
    }
  }
  return found;
}

const near = (box: Record<string, number>) =>
  Object.fromEntries(Object.entries(box).map(([k, v]) => [k, expect.closeTo(v, 3)]));

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

  it('paints each Mark at 300 dots an inch of its size on the page, in the ink', async () => {
    const { paint, asked } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0, y: 0, width: 0.5 };
    await makeRun(paint)(sample('sample.pdf'), signed([mark]));
    // 150 × 75 points is 2 1/12 × 1 1/24 inches.
    expect(asked).toEqual([{ mark, ink: 'black', width: 625, height: 313 }]);
  });

  it('paints no side longer than 2000 pixels', async () => {
    const big = await PDFDocument.create();
    big.addPage([1000, 1000]);
    const { paint, asked } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0, y: 0, width: 1 };
    await makeRun(paint)(asFile(await big.save()), signed([mark]));
    expect(asked.map(({ width, height }) => [width, height])).toEqual([[2000, 1000]]);
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

  it('throws an ordinary error for a file that is not a PDF', async () => {
    const { paint } = standIn();
    const mark: Mark = { kind: 'signature', page: 1, x: 0, y: 0, width: 0.3 };
    const notPdf = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });
    const failure = await makeRun(paint)(notPdf, signed([mark])).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ToolFailure);
  });
});
