import { readFileSync } from 'node:fs';
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { Shrink } from '../../photos/shrink';
import { ToolFailure } from '../types';
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

  it('fills each page inside a half-inch margin, centred, keeping the photo’s proportions', async () => {
    const [result] = await run([photo('sample.jpg'), photo('wide.jpg')], {});
    const doc = await PDFDocument.load(await result!.blob.arrayBuffer());
    // Where each photo is placed, from the page's drawing steps.
    const placed = doc.getPages().map((page) => {
      const contents = page.node.Contents()!;
      const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
      const steps = streams
        .map((s) => doc.context.lookup(s) as PDFRawStream)
        .map((s) => new TextDecoder().decode(decodePDFRawStream(s).decode()))
        .join('\n');
      // pdf-lib moves to the corner ("1 0 0 1 x y cm"), then stretches ("w 0 0 h 0 0 cm").
      const moves = [...steps.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/g)].map((m) =>
        m.slice(1).map(Number),
      );
      const [, , x, y] = moves[0]!;
      const [width, height] = moves.find(([w, h]) => w !== 1 || h !== 1)!;
      return [width, height, x, y];
    });
    // Tall 32 × 48 on 612 × 792: the height fills 792 − 72 = 720, so the width is 480.
    // Wide 48 × 32 on 792 × 612: the height fills 612 − 72 = 540, so the width is 810 — too
    // wide for 720, so the width fills 720 and the height is 480.
    expect(placed).toEqual([
      [480, 720, 66, 36],
      [720, 480, 36, 66],
    ]);
  });

  const cantOpen = makeRun(async (file) => {
    if (file.name === 'sample.jpg') return new Blob([bytes('sample.jpg')]);
    throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
  });

  it("fails with a plain reason naming the iPhone photo (HEIC) that won't open", async () => {
    // The picker may give no file type, so the photo itself is checked.
    const heic = new File([bytes('../make-photo-smaller/IMG_1234.HEIC')], 'IMG_1234.HEIC');
    const failure = await cantOpen([photo('sample.jpg'), heic], {}).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      "IMG_1234.HEIC is an iPhone photo (HEIC) that wouldn't open. Choose it again, or try another photo.",
    );
  });

  it("throws an ordinary error for another photo it can't open", async () => {
    const failure = await cantOpen([photo('sample.jpg'), photo('wide.jpg')], {}).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ToolFailure);
  });
});
