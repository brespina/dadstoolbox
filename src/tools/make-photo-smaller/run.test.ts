import { readFileSync } from 'node:fs';
import exifr from 'exifr';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { tool } from './declaration';
import { makeRun, type Shrink } from './run';

const bytes = (path: string) => readFileSync(new URL(path, import.meta.url));
// A 4032 × 3024 photo marked "turn a quarter turn", with a date taken and a location.
const sample = () => new File([bytes('sample.jpg')], 'sample.jpg', { type: 'image/jpeg' });

// Node has no canvas, so this stands in for the browser's own drawing: it hands back a
// small real JPG made without any photo details, and notes what it was asked for.
const asked: { longestSide: number; quality: number }[] = [];
const shrink: Shrink = async (_file, how) => {
  asked.push(how);
  return new Blob([bytes('painted.jpg')], { type: 'image/jpeg' });
};
const run = makeRun(shrink);

const defaults = tool.defaultOptions;
const details = async (blob: Blob) =>
  (await exifr.parse(new Uint8Array(await blob.arrayBuffer()), {
    tiff: true,
    exif: true,
    gps: true,
    reviveValues: false,
    translateValues: false,
  })) as Record<string, unknown> | undefined;

describe('Make a photo smaller', () => {
  it('makes a smaller JPG named "small", with the date taken and no location', async () => {
    asked.length = 0;
    const [result, ...rest] = await run(sample(), defaults);
    expect(rest).toEqual([]);
    expect(result!.blob.type).toBe('image/jpeg');
    expect(result!.detail).toBe('small');
    expect(result!.blob.size).toBeLessThan(sample().size);
    expect(asked).toEqual([{ longestSide: 2048, quality: 0.82 }]);

    const found = await details(result!.blob);
    expect(found).toMatchObject({
      DateTimeOriginal: '2024:06:01 10:30:00',
      OffsetTimeOriginal: '-05:00',
    });
    expect(found).not.toHaveProperty('latitude');
    expect(found).not.toHaveProperty('Make');
    // The pixels are already the right way up.
    expect(found?.Orientation ?? 1).toBe(1);
  });

  it('keeps the location when Remove location is unticked', async () => {
    const [result] = await run(sample(), { ...defaults, removeLocation: false });
    const found = await details(result!.blob);
    expect(found).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00', GPSLatitudeRef: 'N' });
    expect(found!.latitude).toBeCloseTo(30.2672, 4);
    expect(found!.longitude).toBeCloseTo(-97.7431, 4);
  });

  it('makes each size smaller than the last', async () => {
    asked.length = 0;
    for (const size of ['medium', 'small', 'tiny'] as const)
      await run(sample(), { ...defaults, size });
    expect(asked).toEqual([
      { longestSide: 2048, quality: 0.82 },
      { longestSide: 1280, quality: 0.75 },
      { longestSide: 800, quality: 0.7 },
    ]);
  });

  it('tries once more at a lower quality when the photo came out no smaller', async () => {
    const tried: number[] = [];
    const painted = bytes('painted.jpg');
    // Real JPGs padded at the end: an already small photo, and a first try bigger than it.
    const padded = (extra: number) => new Blob([painted, new Uint8Array(extra)]);
    const original = new File([padded(300)], 'small.jpg', { type: 'image/jpeg' });
    const shrinkTo = makeRun(async (_file, how) => {
      tried.push(how.quality);
      return how.quality < 0.7 ? new Blob([painted]) : padded(1000);
    });
    const [result] = await shrinkTo(original, { ...defaults, size: 'tiny' });
    expect(tried).toEqual([0.7, 0.6]);
    expect(result!.blob.size).toBeLessThan(original.size);
  });

  it('keeps the first try when the lower quality is no smaller either', async () => {
    const tried: number[] = [];
    const original = new File([new Uint8Array(10)], 'tiny.jpg', { type: 'image/jpeg' });
    const painted = bytes('painted.jpg');
    // The lower quality comes out even bigger than the first try.
    const shrinkTo = makeRun(async (_file, how) => {
      tried.push(how.quality);
      return new Blob([painted, new Uint8Array(how.quality < 0.7 ? 500 : 0)]);
    });
    const [result] = await shrinkTo(original, defaults);
    const [first] = await makeRun(async () => new Blob([painted]))(original, defaults);
    expect(tried).toEqual([0.82, 0.6]);
    expect(result!.blob.size).toBe(first!.blob.size);
  });

  it("fails with a plain reason for an iPhone photo (HEIC) that won't open", async () => {
    const cantOpen = makeRun(async () => {
      throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
    });
    // The picker may give no file type, so the photo itself is checked.
    const unnamed = new File([bytes('IMG_1234.HEIC')], 'IMG_1234.HEIC');
    const failure = await cantOpen(unnamed, defaults).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      "This iPhone photo (HEIC) wouldn't open. Choose it again, or try another photo.",
    );
  });

  it("throws an ordinary error for another file it can't open", async () => {
    const cantOpen = makeRun(async () => {
      throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
    });
    const failure = await cantOpen(sample(), defaults).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ToolFailure);
  });
});
