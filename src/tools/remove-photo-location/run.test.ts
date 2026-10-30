import { readFileSync } from 'node:fs';
import exifr from 'exifr';
import { describe, expect, it } from 'vitest';
import { readDetails } from '../../photos/exif';
import { ToolFailure } from '../types';
import { tool } from './declaration';
import { run } from './run';

const bytes = (name: string) => new Uint8Array(readFileSync(new URL(name, import.meta.url)));
const file = (data: Uint8Array, name: string, type: string) =>
  new File([data as Uint8Array<ArrayBuffer>], name, { type });
const jpg = () => file(bytes('sample.jpg'), 'sample.jpg', 'image/jpeg');

const details = async (data: Uint8Array) =>
  (await exifr.parse(data, {
    tiff: true,
    exif: true,
    gps: true,
    reviveValues: false,
    translateValues: false,
  })) as Record<string, unknown> | undefined;

const removed = async (input: File) => {
  const [result, ...rest] = await run(input, tool.defaultOptions);
  expect(rest).toEqual([]);
  expect(result!.blob.type).toBe('image/jpeg');
  return new Uint8Array(await result!.blob.arrayBuffer());
};

describe('Remove photo location', () => {
  it('takes the location out of a JPG', async () => {
    expect(await details(bytes('sample.jpg'))).toHaveProperty('latitude');
    const out = await removed(jpg());
    const found = await details(out);
    expect(found).not.toHaveProperty('latitude');
    expect(found).not.toHaveProperty('GPSLatitude');
    expect(readDetails(out)?.location).toEqual([]);
  });

  it('keeps the date taken, the way up and the picture itself', async () => {
    const original = bytes('sample.jpg');
    const out = await removed(jpg());
    expect(await details(out)).toMatchObject({
      DateTimeOriginal: '2024:06:01 10:30:00',
      OffsetTimeOriginal: '-05:00',
      Orientation: 6,
    });
    expect(out.length).toBe(original.length);
    // Only bytes inside the photo details segment change.
    const [start, end] = detailsSegment(original);
    original.forEach((byte, at) => {
      if (byte !== out[at]) expect(at >= start && at < end, `byte ${at}`).toBe(true);
    });
  });

  it('takes the location out of an extra picture stored after the main one', async () => {
    // Like an iPhone JPG's second picture: a whole JPEG after the first one ends.
    const sample = bytes('sample.jpg');
    const both = new Uint8Array([...sample, ...sample]);
    const out = await removed(file(both, 'both.jpg', 'image/jpeg'));
    expect(readDetails(out.subarray(sample.length))?.location).toEqual([]);
    expect(readDetails(out.subarray(sample.length))?.dates).not.toEqual([]);
  });

  it('takes out a location written as text, as photo editing apps do', async () => {
    const sample = bytes('sample.jpg');
    const text = new TextEncoder().encode(
      'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF>' +
        '<rdf:Description exif:GPSLatitude="30,16.032N" exif:GPSLongitude = \'97,44.586W\'>' +
        '<exif:GPSAltitude>150/1</exif:GPSAltitude>' +
        '<exif:GPSAreaInformation rdf:parseType="Resource"><rdf:Alt>' +
        '<rdf:li xml:lang="x-default">Austin</rdf:li></rdf:Alt></exif:GPSAreaInformation>' +
        '<xmp:CreateDate>2024-06-01T10:30:00</xmp:CreateDate>' +
        '</rdf:Description></rdf:RDF></x:xmpmeta>',
    );
    const segment = new Uint8Array([0xff, 0xe1, (text.length + 2) >> 8, (text.length + 2) & 0xff]);
    // After the JFIF mark, before the other details.
    const edited = new Uint8Array([
      ...sample.subarray(0, 20),
      ...segment,
      ...text,
      ...sample.subarray(20),
    ]);
    const out = await removed(file(edited, 'edited.jpg', 'image/jpeg'));
    const written = new TextDecoder().decode(out);
    for (const place of ['30,16.032N', '97,44.586W', '150/1', 'Austin']) {
      expect(written).not.toContain(place);
    }
    expect(written).toContain('<xmp:CreateDate>2024-06-01T10:30:00</xmp:CreateDate>');
    expect(out.length).toBe(edited.length);
  });

  it('still saves a JPG that has no location, unchanged', async () => {
    const original = bytes('painted.jpg');
    const out = await removed(file(original, 'painted.jpg', 'image/jpeg'));
    expect(out).toEqual(original);
  });

  it('fails plainly for a kind of photo that has no location', async () => {
    const png = file(bytes('transparent.png'), 'transparent.png', 'image/png');
    const failure = await run(png, tool.defaultOptions).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe("This kind of photo doesn't carry a location.");
  });

  it("doesn't save a copy when the location can't be read", async () => {
    const damaged = bytes('sample.jpg');
    // The sample's pointer to its location (big-endian): point it past the end.
    const at = Buffer.from(damaged).indexOf(Buffer.from([0x88, 0x25, 0, 4, 0, 0, 0, 1]));
    expect(at).toBeGreaterThan(0);
    damaged.set([0x7f, 0xff, 0xff, 0xff], at + 8);
    const failure = await run(file(damaged, 'damaged.jpg', 'image/jpeg'), tool.defaultOptions)
      .then(() => 'saved')
      .catch((e: unknown) => e);
    // Not a Tool reason: the page shows "This file may be damaged or not supported."
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ToolFailure);
  });

  it('points an iPhone photo (HEIC) to Change a photo to JPG for now', async () => {
    // Its file type is often missing.
    const heic = file(bytes('iphone.heic'), 'iphone.heic', '');
    const failure = await run(heic, tool.defaultOptions).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      "This can't take the location out of an iPhone photo (HEIC) yet. Use Change a photo to JPG with Remove location ticked.",
    );
  });
});

/** Where the first photo details segment (APP1 "Exif") of a JPEG starts and ends. */
function detailsSegment(jpeg: Uint8Array): [number, number] {
  for (let at = 2; jpeg[at] === 0xff && jpeg[at + 1] !== 0xda;) {
    const end = at + 2 + ((jpeg[at + 2]! << 8) | jpeg[at + 3]!);
    if (jpeg[at + 1] === 0xe1) return [at, end];
    at = end;
  }
  throw new Error('No details segment');
}
