import { readFileSync } from 'node:fs';
import { degrees, PDFDocument, PDFName, PDFNumber } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { run } from './run';

const sample = (name: string) =>
  new File([readFileSync(new URL(name, import.meta.url))], name, { type: 'application/pdf' });

/** Each page's turn, in degrees, in the one PDF that comes out. */
async function anglesOf(results: Awaited<ReturnType<typeof run>>) {
  expect(results).toHaveLength(1);
  expect(results[0].blob.type).toBe('application/pdf');
  const doc = await PDFDocument.load(await results[0].blob.arrayBuffer());
  return doc.getPages().map((page) => page.getRotation().angle);
}

describe('Rotate PDF pages', () => {
  it('turns every page right', async () => {
    const results = await run(sample('sample.pdf'), { turn: 'right' });
    expect(await anglesOf(results)).toEqual([90, 90, 90]);
  });

  it('turns every page left', async () => {
    const results = await run(sample('sample.pdf'), { turn: 'left' });
    expect(await anglesOf(results)).toEqual([270, 270, 270]);
  });

  it('turns every page upside down', async () => {
    const results = await run(sample('sample.pdf'), { turn: 'upsideDown' });
    expect(await anglesOf(results)).toEqual([180, 180, 180]);
  });

  it('adds to the turn a page already had, staying under a full turn', async () => {
    const turned = await pdfWithPages([90, 270, 180]);
    expect(await anglesOf(await run(turned, { turn: 'right' }))).toEqual([180, 0, 270]);
    expect(await anglesOf(await run(turned, { turn: 'left' }))).toEqual([0, 180, 90]);
    expect(await anglesOf(await run(turned, { turn: 'upsideDown' }))).toEqual([270, 90, 0]);
  });

  it('adds to a turn the pages get from the PDF as a whole', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 200]);
    doc.addPage([300, 200]);
    doc.catalog.Pages().set(PDFName.of('Rotate'), PDFNumber.of(90));
    const bytes = await doc.save();
    const turned = new File([bytes as Uint8Array<ArrayBuffer>], 'turned.pdf', {
      type: 'application/pdf',
    });
    expect(await anglesOf(await run(turned, { turn: 'right' }))).toEqual([180, 180]);
  });

  it('fails with the same reason as Split a PDF for a PDF with a password', async () => {
    const failure = await run(sample('sample-password.pdf'), { turn: 'right' }).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      'This PDF has a password. Remove it and try again.',
    );
  });

  it('throws an ordinary error for a file that is not a PDF', async () => {
    const notPdf = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });
    const failure = await run(notPdf, { turn: 'right' }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ToolFailure);
  });
});

/** A PDF whose pages are already turned by these amounts. */
async function pdfWithPages(angles: number[]) {
  const doc = await PDFDocument.create();
  for (const angle of angles) doc.addPage([300, 200]).setRotation(degrees(angle));
  const bytes = await doc.save();
  return new File([bytes as Uint8Array<ArrayBuffer>], 'turned.pdf', { type: 'application/pdf' });
}
