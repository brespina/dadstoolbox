import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
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
});
