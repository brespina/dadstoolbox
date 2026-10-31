import { readFileSync } from 'node:fs';
import exifr from 'exifr';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { tool } from './declaration';
import { makeRun, type Paint, type PaintSquares } from './run';

const bytes = (name: string) => readFileSync(new URL(name, import.meta.url));
const sample = (name: string, type: string) => new File([bytes(name)], name, { type });
const heic = () => sample('sample.heic', 'image/heic');
const jpg = () => sample('rotated.jpg', 'image/jpeg');

// Node has no canvas, so this stands in for the browser's own drawing: it hands back a
// small real file of the asked-for type, made without any photo details.
const painted: Record<string, string> = {
  'image/jpeg': 'painted.jpg',
  'image/png': 'transparent.png',
  'image/webp': 'painted.webp',
};
const paint: Paint = async (_file, type) => ({
  blob: new Blob([bytes(painted[type]!)], { type }),
  width: 32,
  height: 48,
});
// Likewise for the squares of an ICO: each is a real PNG, the asked-for size, in solid
// red, so the test can check the file's layout and what it holds.
const paintSquares: PaintSquares = async (_file, sizes) =>
  sizes.map((size) => {
    const square = new PNG({ width: size, height: size });
    for (let at = 0; at < square.data.length; at += 4) square.data.set([255, 0, 0, 255], at);
    const data = PNG.sync.write(square);
    return {
      blob: new Blob([new Uint8Array(data)], { type: 'image/png' }),
      width: size,
      height: size,
    };
  });
const run = makeRun(paint, paintSquares);

const defaults = tool.defaultOptions;
const details = async (blob: Blob) =>
  (await exifr.parse(new Uint8Array(await blob.arrayBuffer()), {
    tiff: true,
    exif: true,
    gps: true,
    reviveValues: false,
    translateValues: false,
  })) as Record<string, unknown> | undefined;

describe('Change image file type', () => {
  it('changes an iPhone photo (HEIC) to a JPG with no location, keeping the date taken', async () => {
    const [result, ...rest] = await run(heic(), defaults);
    expect(rest).toEqual([]);
    expect(result!.blob.type).toBe('image/jpeg');
    expect(result!.detail).toBeUndefined();
    const found = await details(result!.blob);
    expect(found).toMatchObject({
      DateTimeOriginal: '2024:06:01 10:30:00',
      OffsetTimeOriginal: '-05:00',
    });
    expect(found).not.toHaveProperty('GPSLatitude');
    expect(found).not.toHaveProperty('latitude');
    expect(found).not.toHaveProperty('Make');
    // The pixels are already the right way up.
    expect(found?.Orientation ?? 1).toBe(1);
  });

  it('keeps the location when Remove location is unticked', async () => {
    const [result] = await run(heic(), { ...defaults, removeLocation: false });
    const found = await details(result!.blob);
    expect(found).toMatchObject({
      DateTimeOriginal: '2024:06:01 10:30:00',
      GPSLatitudeRef: 'N',
      GPSLongitudeRef: 'W',
    });
    expect(found!.latitude).toBeCloseTo(30.2672, 4);
    expect(found!.longitude).toBeCloseTo(-97.7431, 4);
  });

  it('saves a JPG as a JPG again, the right way up and with its location removed', async () => {
    // rotated.jpg is marked "turn a quarter turn" and has a location.
    const [result] = await run(jpg(), defaults);
    const found = await details(result!.blob);
    expect(result!.blob.type).toBe('image/jpeg');
    expect(found).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00' });
    expect(found).not.toHaveProperty('latitude');
    expect(found?.Orientation ?? 1).toBe(1);
  });

  it('saves as PNG with the date taken and, when asked, the location', async () => {
    const [result] = await run(jpg(), { ...defaults, format: 'png', removeLocation: false });
    expect(result!.blob.type).toBe('image/png');
    const found = await details(result!.blob);
    expect(found).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00', GPSLatitudeRef: 'N' });
    expect(found?.Orientation ?? 1).toBe(1);
  });

  it('saves as WebP with the date taken and no location', async () => {
    const [result] = await run(heic(), { ...defaults, format: 'webp' });
    expect(result!.blob.type).toBe('image/webp');
    const saved = new Uint8Array(await result!.blob.arrayBuffer());
    const chunks = webpChunks(saved);
    // The extended header comes first and says photo details follow.
    expect(chunks.map((c) => c.type)).toEqual(['VP8X', 'VP8 ', 'EXIF']);
    expect(chunks[0]!.data[0]! & 0x08).toBe(0x08);
    // Width and height, less one, in the extended header.
    expect([...chunks[0]!.data.subarray(4, 10)]).toEqual([31, 0, 0, 47, 0, 0]);
    expect(new DataView(saved.buffer).getUint32(4, true)).toBe(saved.length - 8);
    const found = await details(new Blob([chunks[2]!.data.slice()]));
    expect(found).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00' });
    expect(found).not.toHaveProperty('latitude');
  });

  it('saves a photo with no details, with none added but the right-way-up mark', async () => {
    const [result] = await run(sample('transparent.png', 'image/png'), defaults);
    const found = await details(result!.blob);
    expect(found).not.toHaveProperty('DateTimeOriginal');
    expect(found?.Orientation ?? 1).toBe(1);
  });

  it('saves as an ICO that holds 16, 32, 48 and 256 px pictures', async () => {
    const [result, ...rest] = await run(jpg(), { ...defaults, format: 'ico' });
    expect(rest).toEqual([]);
    expect(result!.blob.type).toBe('image/x-icon');
    const entries = icoEntries(new Uint8Array(await result!.blob.arrayBuffer()));
    expect(entries.map((e) => [e.width, e.height])).toEqual([
      [16, 16],
      [32, 32],
      [48, 48],
      [256, 256],
    ]);
    // Each picture is a whole PNG that opens as the size the directory says.
    for (const entry of entries) {
      const picture = PNG.sync.read(Buffer.from(entry.png));
      expect([picture.width, picture.height]).toEqual([entry.width, entry.height]);
    }
  });

  it("fails with a plain reason for an iPhone photo (HEIC) that won't open", async () => {
    const cantOpen = makeRun(async () => {
      throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
    });
    // The picker may give no file type, so the photo itself is checked.
    const unnamed = new File([bytes('sample.heic')], 'IMG_1234.HEIC');
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
    const failure = await cantOpen(jpg(), defaults).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ToolFailure);
  });
});

/** The chunks of a WebP file, read straight from its bytes. */
function webpChunks(file: Uint8Array) {
  const view = new DataView(file.buffer);
  const chunks: { type: string; data: Uint8Array }[] = [];
  for (let at = 12; at < file.length;) {
    const length = view.getUint32(at + 4, true);
    const type = String.fromCharCode(...file.subarray(at, at + 4));
    chunks.push({ type, data: file.subarray(at + 8, at + 8 + length) });
    at += 8 + length + (length % 2);
  }
  return chunks;
}

/** The pictures in an ICO file, read straight from its bytes. */
function icoEntries(file: Uint8Array) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  // Reserved, then 1 for an icon, then how many pictures.
  expect([view.getUint16(0, true), view.getUint16(2, true)]).toEqual([0, 1]);
  return Array.from({ length: view.getUint16(4, true) }, (_, i) => {
    const at = 6 + i * 16;
    const length = view.getUint32(at + 8, true);
    const offset = view.getUint32(at + 12, true);
    return {
      // A 0 in the file means 256.
      width: view.getUint8(at) || 256,
      height: view.getUint8(at + 1) || 256,
      png: file.subarray(offset, offset + length),
    };
  });
}
