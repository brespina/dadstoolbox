import { readFileSync } from 'node:fs';
import exifr from 'exifr';
import { describe, expect, it } from 'vitest';
import { isHeif, readDetails } from '../../photos/exif';
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

  it('takes the location out of an iPhone photo (HEIC), keeping it a HEIC', async () => {
    const original = bytes('iphone.heic');
    const before = readDetails(original)!;
    expect(before.location).toHaveLength(7);
    // Its file type is often missing.
    const [result] = await run(file(original, 'iphone.heic', ''), tool.defaultOptions);
    expect(result!.blob.type).toBe('image/heic');
    const out = new Uint8Array(await result!.blob.arrayBuffer());
    expect(isHeif(out)).toBe(true);
    const after = readDetails(out)!;
    expect(after.location).toEqual([]);
    expect(after.dates).toEqual(before.dates);
    expect(after.main).toEqual(before.main);
    expect(out.length).toBe(original.length);
    // Only the photo details item changes: it starts at byte 559 (from the sample's item
    // list). The boxes before it and the picture itself (bytes 489 to 559) stay the same.
    original.forEach((byte, at) => {
      if (byte !== out[at]) expect(at >= 559, `byte ${at}`).toBe(true);
    });
  });

  it('takes out a location written as text in an iPhone photo (HEIC)', async () => {
    const xmp =
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF>' +
      '<rdf:Description exif:GPSLatitude="30,16.032N" exif:GPSLongitude="97,44.586W">' +
      '<xmp:CreateDate>2024-06-01T10:30:00</xmp:CreateDate>' +
      '</rdf:Description></rdf:RDF></x:xmpmeta>';
    const edited = withXmpItem(bytes('iphone.heic'), xmp);
    // The made-up file still reads as before, with the text where the item list says.
    expect(readDetails(edited)?.location).toHaveLength(7);
    expect(new TextDecoder().decode(edited.subarray(-xmp.length))).toBe(xmp);

    const [result] = await run(file(edited, 'edited.heic', 'image/heic'), tool.defaultOptions);
    const out = new Uint8Array(await result!.blob.arrayBuffer());
    expect(readDetails(out)?.location).toEqual([]);
    const written = new TextDecoder().decode(out);
    for (const place of ['30,16.032N', '97,44.586W']) expect(written).not.toContain(place);
    expect(written).toContain('<xmp:CreateDate>2024-06-01T10:30:00</xmp:CreateDate>');
    expect(out.length).toBe(edited.length);
  });

  it.each([
    // Bytes 111–114 of the sample: where its photo details item starts. Point it past the end.
    ["stored somewhere it can't reach", 111, [0x7f, 0xff, 0xff, 0xff]],
    // Byte 562: the end of "how far in the details begin". Point it into their middle.
    ["that aren't photo details", 562, [0x40]],
  ] as const)(
    "doesn't save a copy of an iPhone photo (HEIC) with details %s",
    async (_, at, change) => {
      const damaged = bytes('iphone.heic');
      damaged.set(change, at);
      const failure = await run(file(damaged, 'damaged.heic', 'image/heic'), tool.defaultOptions)
        .then(() => 'saved')
        .catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(ToolFailure);
    },
  );
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

/**
 * The HEIC sample with an XMP text item added, as photo editing apps write. Offsets are
 * the sample's: meta box at 28, iloc at 73 (item count at 87, the two items' offsets at
 * 93 and 111), iinf at 125 (entry count at 137) ending at 181. The text goes at the end.
 */
function withXmpItem(heic: Uint8Array, xmp: string): Uint8Array {
  const encoder = new TextEncoder();
  const infeContent = [
    ...[2, 0, 0, 0], // version 2
    ...[0, 3, 0, 0], // item 3, not protected
    ...encoder.encode('mime\0application/rdf+xml\0'), // type, empty name, content type
  ];
  const infe = [0, 0, 0, 8 + infeContent.length, ...encoder.encode('infe'), ...infeContent];
  const ilocEntry = new Uint8Array(18); // item 3, in one piece
  const added = ilocEntry.length + infe.length;
  const text = encoder.encode(xmp);
  const textAt = heic.length + added + 8;
  const ilocView = new DataView(ilocEntry.buffer);
  ilocView.setUint16(0, 3);
  ilocView.setUint32(4, textAt);
  ilocView.setUint16(8, 1);
  ilocView.setUint32(14, text.length);
  const mdat = new Uint8Array(8);
  new DataView(mdat.buffer).setUint32(0, 8 + text.length);
  mdat.set(encoder.encode('mdat'), 4);

  const out = new Uint8Array([
    ...heic.subarray(0, 125),
    ...ilocEntry,
    ...heic.subarray(125, 181),
    ...infe,
    ...heic.subarray(181),
    ...mdat,
    ...text,
  ]);
  const view = new DataView(out.buffer);
  const add = (at: number, by: number, size: 2 | 4 = 4) =>
    size === 4
      ? view.setUint32(at, view.getUint32(at) + by)
      : view.setUint16(at, view.getUint16(at) + by);
  add(28, added); // meta size
  add(73, ilocEntry.length); // iloc size
  add(87, 1, 2); // iloc item count
  add(93, added); // where the picture is
  add(111, added); // where the photo details are
  add(125 + ilocEntry.length, infe.length); // iinf size
  add(137 + ilocEntry.length, 1, 2); // iinf entry count
  return out;
}
