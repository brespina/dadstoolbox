import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { openToSign } from './can-sign';

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
});
