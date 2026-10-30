import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { Shrink } from '../../photos/shrink';
import { makeRun } from './run';

const bytes = (name: string) => readFileSync(new URL(name, import.meta.url));
// sample.jpg shows 32 × 48 (tall); wide.jpg 48 × 32. Neither carries any photo details.
const photo = (name: string) => new File([bytes(name)], name, { type: 'image/jpeg' });

// Node has no canvas, so this stands in for the browser's drawing: it hands back the
// photo's own small JPG, already the right way up, and notes what it was asked for.
const asked: { name: string; longestSide: number; quality: number }[] = [];
const draw: Shrink = async (file, how) => {
  asked.push({ name: file.name, ...how });
  return new Blob([await file.arrayBuffer()], { type: 'image/jpeg' });
};
const run = makeRun(draw);

/** Each page's width and height, in points. */
async function pageSizes(blob: Blob) {
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  return doc.getPages().map((page) => [page.getWidth(), page.getHeight()]);
}

describe('Photos to one PDF', () => {
  it('puts each photo on its own Letter page, in the order given; a wide photo gets a sideways page', async () => {
    asked.length = 0;
    const results = await run([photo('sample.jpg'), photo('wide.jpg'), photo('sample.jpg')], {});
    expect(results).toHaveLength(1);
    expect(results[0]!.blob.type).toBe('application/pdf');
    expect(results[0]!.detail).toBeUndefined();
    expect(await pageSizes(results[0]!.blob)).toEqual([
      [612, 792],
      [792, 612],
      [612, 792],
    ]);
    // Drawn sharp enough to read a receipt: about 300 dots an inch on a Letter page.
    expect(asked.map((a) => a.name)).toEqual(['sample.jpg', 'wide.jpg', 'sample.jpg']);
    expect(asked[0]).toMatchObject({ longestSide: 3000, quality: 0.9 });
  });
});
