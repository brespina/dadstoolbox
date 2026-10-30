import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { run } from './run';

const sample = (name: string) =>
  new File([readFileSync(new URL(name, import.meta.url))], name, { type: 'application/pdf' });

describe('Split a PDF', () => {
  it('makes one PDF per page, each with one page, named page1, page2, page3', async () => {
    const results = await run(sample('sample.pdf'), {});
    expect(results.map((r) => r.detail)).toEqual(['page1', 'page2', 'page3']);
    for (const result of results) {
      expect(result.blob.type).toBe('application/pdf');
      const doc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(doc.getPageCount()).toBe(1);
    }
  });

  it('fails with a plain reason for a PDF with a password', async () => {
    const failure = await run(sample('sample-password.pdf'), {}).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      'This PDF has a password. Remove it and try again.',
    );
  });

  it('throws an ordinary error for a file that is not a PDF', async () => {
    const notPdf = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });
    const failure = await run(notPdf, {}).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ToolFailure);
  });
});
