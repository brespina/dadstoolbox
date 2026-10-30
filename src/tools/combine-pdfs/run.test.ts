import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { run } from './run';

const sample = (name: string) =>
  new File([readFileSync(new URL(name, import.meta.url))], name, { type: 'application/pdf' });

/** Page widths tell the samples apart: sample.pdf has two 200-wide pages, sample-2.pdf one 400-wide. */
async function pageWidths(blob: Blob) {
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  return doc.getPages().map((page) => page.getWidth());
}

describe('Combine PDFs', () => {
  it('makes one PDF with every page, in the order given', async () => {
    const results = await run([sample('sample.pdf'), sample('sample-2.pdf')], {});
    expect(results).toHaveLength(1);
    expect(results[0]!.blob.type).toBe('application/pdf');
    expect(results[0]!.detail).toBeUndefined();
    expect(await pageWidths(results[0]!.blob)).toEqual([200, 200, 400]);
  });

  it('follows a changed order', async () => {
    const [result] = await run([sample('sample-2.pdf'), sample('sample.pdf')], {});
    expect(await pageWidths(result!.blob)).toEqual([400, 200, 200]);
  });

  it('fails with a plain reason naming the PDF that has a password', async () => {
    const failure = await run([sample('sample.pdf'), sample('sample-password.pdf')], {}).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      'sample-password.pdf: This PDF has a password. Remove it and try again.',
    );
  });

  it('throws an ordinary error for a file that is not a PDF', async () => {
    const notPdf = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });
    const failure = await run([sample('sample.pdf'), notPdf], {}).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ToolFailure);
  });
});
