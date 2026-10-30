// Photo details (EXIF) for the photo Tools, in plain TypeScript with no library.
// Drawing a photo on a canvas drops all its details, so the Tools read the few worth
// keeping (date taken, and location when asked) from the chosen file and write them
// into the saved one. Everything else, such as the camera model, is left out.
//
// Values are copied byte for byte, so the new details keep the original's byte order.
// Any file this can't read simply has no details to keep.

/** One TIFF entry. `value` holds the entry's bytes in the original's byte order. */
interface Entry {
  tag: number;
  type: number;
  count: number;
  value: Uint8Array;
}

export interface PhotoDetails {
  littleEndian: boolean;
  /** Date entries from the main list (DateTime). */
  main: Entry[];
  /** Date entries from the Exif list: when taken and digitized, with time zone and parts of a second. */
  dates: Entry[];
  /** The whole GPS list: the photo's location. */
  location: Entry[];
}

/** Bytes per value, by TIFF type. Types not listed here are skipped. */
const typeSizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

const tags = {
  orientation: 0x0112,
  dateTime: 0x0132,
  exifList: 0x8769,
  gpsList: 0x8825,
};
const dateTags = new Set([
  0x9003, // DateTimeOriginal: when it was taken
  0x9004, // DateTimeDigitized
  0x9010, // OffsetTime
  0x9011, // OffsetTimeOriginal
  0x9012, // OffsetTimeDigitized
  0x9290, // SubSecTime
  0x9291, // SubSecTimeOriginal
  0x9292, // SubSecTimeDigitized
]);

const ascii = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, at + length));

const exifPrefix = 'Exif\0\0';
/** Some files put "Exif\0\0" before the TIFF bytes; drop it. */
const withoutPrefix = (bytes: Uint8Array) =>
  ascii(bytes, 0, 6) === exifPrefix ? bytes.subarray(6) : bytes;

/** The photo details of a JPEG, iPhone photo (HEIC), PNG or WebP file, if it has any. */
export function readDetails(file: Uint8Array): PhotoDetails | undefined {
  try {
    const tiff = findTiff(file);
    return tiff && readTiff(tiff);
  } catch {
    // A damaged or unusual file: there are no details we can keep.
    return undefined;
  }
}

/** True when the bytes are an iPhone photo (HEIC) or another HEIF file. */
export function isHeif(file: Uint8Array): boolean {
  return (
    ascii(file, 4, 4) === 'ftyp' &&
    ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1'].includes(ascii(file, 8, 4))
  );
}

/** True when the bytes are a JPEG. */
export const isJpeg = (file: Uint8Array) => file[0] === 0xff && file[1] === 0xd8;

function findTiff(file: Uint8Array): Uint8Array | undefined {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (isJpeg(file)) return findInJpeg(file, view);
  if (ascii(file, 1, 3) === 'PNG') return findInPng(file, view);
  if (ascii(file, 0, 4) === 'RIFF' && ascii(file, 8, 4) === 'WEBP') return findInWebp(file, view);
  if (ascii(file, 4, 4) === 'ftyp') return findInHeif(file, view);
  return undefined;
}

function findInJpeg(file: Uint8Array, view: DataView) {
  let at = 2;
  while (at + 4 <= file.length && file[at] === 0xff) {
    const marker = file[at + 1]!;
    // Start of the picture itself: no details after this.
    if (marker === 0xda) return undefined;
    const length = view.getUint16(at + 2);
    if (marker === 0xe1 && ascii(file, at + 4, 6) === exifPrefix) {
      return file.subarray(at + 10, at + 2 + length);
    }
    at += 2 + length;
  }
  return undefined;
}

function findInPng(file: Uint8Array, view: DataView) {
  for (let at = 8; at + 8 <= file.length;) {
    const length = view.getUint32(at);
    const type = ascii(file, at + 4, 4);
    if (type === 'eXIf') return withoutPrefix(file.subarray(at + 8, at + 8 + length));
    if (type === 'IDAT' || type === 'IEND') return undefined;
    at += 12 + length;
  }
  return undefined;
}

function findInWebp(file: Uint8Array, view: DataView) {
  for (let at = 12; at + 8 <= file.length;) {
    const length = view.getUint32(at + 4, true);
    if (ascii(file, at, 4) === 'EXIF') {
      return withoutPrefix(file.subarray(at + 8, at + 8 + length));
    }
    at += 8 + length + (length % 2);
  }
  return undefined;
}

/** The boxes inside `start`…`end`, as [type, content start, end]. */
function* boxes(file: Uint8Array, view: DataView, start: number, end: number) {
  for (let at = start; at + 8 <= end;) {
    let size = view.getUint32(at);
    let header = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(at + 8));
      header = 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < header) return;
    yield [ascii(file, at + 4, 4), at + header, Math.min(at + size, end)] as const;
    at += size;
  }
}

function findInHeif(file: Uint8Array, view: DataView) {
  const meta = [...boxes(file, view, 0, file.length)].find(([type]) => type === 'meta');
  if (!meta) return undefined;
  // meta is a "full box": 4 bytes of version and flags come first.
  const inside = [...boxes(file, view, meta[1] + 4, meta[2])];
  const iinf = inside.find(([type]) => type === 'iinf');
  const iloc = inside.find(([type]) => type === 'iloc');
  if (!iinf || !iloc) return undefined;

  // Find the Exif item's number in the item list.
  let exifItem: number | undefined;
  const iinfVersion = file[iinf[1]]!;
  for (const [type, start] of boxes(file, view, iinf[1] + (iinfVersion === 0 ? 6 : 8), iinf[2])) {
    if (type !== 'infe') continue;
    const version = file[start]!;
    if (version < 2) continue;
    const id = version === 2 ? view.getUint16(start + 4) : view.getUint32(start + 4);
    const typeAt = start + (version === 2 ? 8 : 10);
    if (ascii(file, typeAt, 4) === 'Exif') exifItem = id;
  }
  if (exifItem === undefined) return undefined;

  // Find where that item's bytes are.
  let at = iloc[1];
  const version = file[at]!;
  at += 4;
  const offsetSize = file[at]! >> 4;
  const lengthSize = file[at]! & 15;
  const baseOffsetSize = file[at + 1]! >> 4;
  const indexSize = version === 1 || version === 2 ? file[at + 1]! & 15 : 0;
  at += 2;
  const readSized = (size: number) => {
    const value =
      size === 0
        ? 0
        : size === 4
          ? view.getUint32(at)
          : size === 8
            ? Number(view.getBigUint64(at))
            : NaN;
    if (Number.isNaN(value)) throw new Error(`Unexpected size ${size}`);
    at += size;
    return value;
  };
  const itemCount = version < 2 ? view.getUint16(at) : view.getUint32(at);
  at += version < 2 ? 2 : 4;
  for (let i = 0; i < itemCount; i++) {
    const id = version < 2 ? view.getUint16(at) : view.getUint32(at);
    at += version < 2 ? 2 : 4;
    let method = 0;
    if (version === 1 || version === 2) {
      method = view.getUint16(at) & 15;
      at += 2;
    }
    at += 2; // data reference index
    const baseOffset = readSized(baseOffsetSize);
    const extentCount = view.getUint16(at);
    at += 2;
    let first: { offset: number; length: number } | undefined;
    for (let e = 0; e < extentCount; e++) {
      readSized(indexSize);
      const offset = readSized(offsetSize);
      const length = readSized(lengthSize);
      first ??= { offset, length };
    }
    if (id !== exifItem) continue;
    // Only items stored straight in the file, in one piece, are read.
    if (method !== 0 || extentCount !== 1 || !first) return undefined;
    const start = baseOffset + first.offset;
    const item = file.subarray(start, start + first.length);
    // The item starts with how far in the TIFF bytes begin.
    const tiffAt = 4 + new DataView(item.buffer, item.byteOffset).getUint32(0);
    return withoutPrefix(item.subarray(tiffAt));
  }
  return undefined;
}

function readTiff(tiff: Uint8Array): PhotoDetails | undefined {
  const order = ascii(tiff, 0, 2);
  if (order !== 'II' && order !== 'MM') return undefined;
  const littleEndian = order === 'II';
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  if (view.getUint16(2, littleEndian) !== 42) return undefined;

  const readList = (offset: number): Entry[] => {
    const count = view.getUint16(offset, littleEndian);
    const entries: Entry[] = [];
    for (let i = 0; i < count; i++) {
      const at = offset + 2 + i * 12;
      const tag = view.getUint16(at, littleEndian);
      const type = view.getUint16(at + 2, littleEndian);
      const valueCount = view.getUint32(at + 4, littleEndian);
      const size = typeSizes[type];
      if (!size) continue;
      const length = size * valueCount;
      const valueAt = length <= 4 ? at + 8 : view.getUint32(at + 8, littleEndian);
      if (valueAt + length > tiff.length) continue;
      entries.push({ tag, type, count: valueCount, value: tiff.slice(valueAt, valueAt + length) });
    }
    return entries;
  };
  const pointer = (entries: Entry[], tag: number) => {
    const entry = entries.find((e) => e.tag === tag);
    return entry && new DataView(entry.value.buffer).getUint32(0, littleEndian);
  };

  const main = readList(view.getUint32(4, littleEndian));
  const exifAt = pointer(main, tags.exifList);
  const gpsAt = pointer(main, tags.gpsList);
  return {
    littleEndian,
    main: main.filter((e) => e.tag === tags.dateTime),
    dates: exifAt ? readList(exifAt).filter((e) => dateTags.has(e.tag)) : [],
    location: gpsAt ? readList(gpsAt) : [],
  };
}

/**
 * Takes the location out of TIFF bytes in place, keeping their length, so nothing
 * around them moves. The GPS list and its values are blanked, and the main list's
 * pointer to it is removed. Everything else, such as the date taken, is untouched.
 * Throws when the bytes can't be read, so a copy never claims to have no location
 * when it may still have one.
 */
function blankLocation(tiff: Uint8Array): void {
  const littleEndian = ascii(tiff, 0, 2) === 'II';
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const zero = (at: number, length: number) => {
    if (at + length > tiff.length) throw new RangeError('Photo details run past the end');
    tiff.fill(0, at, at + length);
  };

  const mainAt = view.getUint32(4, littleEndian);
  const mainCount = view.getUint16(mainAt, littleEndian);
  const mainEnd = mainAt + 2 + mainCount * 12 + 4; // The entries and the next-list mark.
  if (mainEnd > tiff.length) throw new RangeError('Photo details run past the end');
  const index = Array.from({ length: mainCount }, (_, i) => mainAt + 2 + i * 12).find(
    (at) => view.getUint16(at, littleEndian) === tags.gpsList,
  );
  if (index === undefined) return;

  const gpsAt = view.getUint32(index + 8, littleEndian);
  const gpsCount = view.getUint16(gpsAt, littleEndian);
  for (let i = 0; i < gpsCount; i++) {
    const at = gpsAt + 2 + i * 12;
    const size = typeSizes[view.getUint16(at + 2, littleEndian)];
    if (!size) throw new RangeError('Unknown kind of location value');
    const length = size * view.getUint32(at + 4, littleEndian);
    if (length > 4) zero(view.getUint32(at + 8, littleEndian), length);
  }
  // The GPS list's own next-list mark is left alone: some files put a value there.
  zero(gpsAt, 2 + gpsCount * 12);

  // Drop the pointer, moving the later entries and the next-list mark up. Entries stay sorted.
  tiff.copyWithin(index, index + 12, mainEnd);
  zero(mainEnd - 12, 12);
  view.setUint16(mainAt, mainCount - 1, littleEndian);
}

const isTiff = (bytes: Uint8Array) => ['II*\0', 'MM\0*'].includes(ascii(bytes, 0, 4));

/**
 * A copy of a JPEG with the location taken out of its photo details, byte for byte
 * the same otherwise: the same length, picture and date taken. Every set of details in
 * the file is cleaned, including those of extra pictures stored after the main one.
 * A JPEG with no location comes back unchanged.
 */
export function jpegWithoutLocation(jpeg: Uint8Array): Uint8Array {
  const copy = jpeg.slice();
  const view = new DataView(copy.buffer);
  // The picture's own bytes can never hold FF E1, so every match is a details segment.
  for (let at = 2; at + 18 <= copy.length; at++) {
    if (copy[at] !== 0xff || copy[at + 1] !== 0xe1 || ascii(copy, at + 4, 6) !== exifPrefix) {
      continue;
    }
    const tiff = copy.subarray(at + 10, at + 2 + view.getUint16(at + 2));
    if (isTiff(tiff)) blankLocation(tiff);
  }
  return copy;
}

/**
 * TIFF bytes holding the date taken, the right-way-up mark (the pixels are already
 * upright) and, when `keepLocation`, the location.
 */
export function buildTiff(details: PhotoDetails | undefined, keepLocation: boolean): Uint8Array {
  const littleEndian = details?.littleEndian ?? false;
  const dates = details?.dates ?? [];
  const location = keepLocation ? (details?.location ?? []) : [];

  const short = (value: number) => {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, littleEndian);
    return bytes;
  };
  const long = (value: number) => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, littleEndian);
    return bytes;
  };
  const listSize = (entries: Entry[]) =>
    2 + entries.length * 12 + 4 + entries.reduce((sum, e) => sum + outOfLine(e), 0);
  const outOfLine = (e: Entry) => (e.value.length > 4 ? e.value.length + (e.value.length % 2) : 0);

  // The main list points to the other two, so their places are worked out first.
  const mainCount =
    1 + (details?.main.length ?? 0) + (dates.length ? 1 : 0) + (location.length ? 1 : 0);
  const mainDataSize = (details?.main ?? []).reduce((sum, e) => sum + outOfLine(e), 0);
  const mainSize = 2 + mainCount * 12 + 4 + mainDataSize;
  const datesAt = 8 + mainSize;
  const locationAt = datesAt + (dates.length ? listSize(dates) : 0);

  const main: Entry[] = [
    { tag: tags.orientation, type: 3, count: 1, value: short(1) },
    ...(details?.main ?? []),
  ];
  if (dates.length) main.push({ tag: tags.exifList, type: 4, count: 1, value: long(datesAt) });
  if (location.length) {
    main.push({ tag: tags.gpsList, type: 4, count: 1, value: long(locationAt) });
  }

  const total = locationAt + (location.length ? listSize(location) : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set([...(littleEndian ? 'II' : 'MM')].map((c) => c.charCodeAt(0)));
  view.setUint16(2, 42, littleEndian);
  view.setUint32(4, 8, littleEndian);

  const writeList = (entries: Entry[], at: number) => {
    const sorted = [...entries].sort((a, b) => a.tag - b.tag);
    view.setUint16(at, sorted.length, littleEndian);
    let dataAt = at + 2 + sorted.length * 12 + 4;
    sorted.forEach((entry, i) => {
      const entryAt = at + 2 + i * 12;
      view.setUint16(entryAt, entry.tag, littleEndian);
      view.setUint16(entryAt + 2, entry.type, littleEndian);
      view.setUint32(entryAt + 4, entry.count, littleEndian);
      if (entry.value.length <= 4) {
        out.set(entry.value, entryAt + 8);
      } else {
        view.setUint32(entryAt + 8, dataAt, littleEndian);
        out.set(entry.value, dataAt);
        dataAt += outOfLine(entry);
      }
    });
    // The next-list mark after the entries stays 0: there is none.
  };
  writeList(main, 8);
  if (dates.length) writeList(dates, datesAt);
  if (location.length) writeList(location, locationAt);
  return out;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};
const bytesOf = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
const u32 = (value: number, littleEndian = false) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, littleEndian);
  return bytes;
};

/** A JPEG with the TIFF bytes added as its details, after its opening marks. */
export function jpegWithDetails(jpeg: Uint8Array, tiff: Uint8Array): Uint8Array {
  const segment = concat(new Uint8Array([0xff, 0xe1, 0, 0]), bytesOf(exifPrefix), tiff);
  new DataView(segment.buffer).setUint16(2, segment.length - 2);
  // Keep the JFIF mark first when there is one, as the JFIF format asks.
  let at = 2;
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) at += 2 + ((jpeg[4]! << 8) | jpeg[5]!);
  return concat(jpeg.subarray(0, at), segment, jpeg.subarray(at));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A PNG with the TIFF bytes added as its details, right after its header. */
export function pngWithDetails(png: Uint8Array, tiff: Uint8Array): Uint8Array {
  const typeAndData = concat(bytesOf('eXIf'), tiff);
  const chunk = concat(u32(tiff.length), typeAndData, u32(crc32(typeAndData)));
  const headerEnd = 8 + 12 + new DataView(png.buffer, png.byteOffset).getUint32(8);
  return concat(png.subarray(0, headerEnd), chunk, png.subarray(headerEnd));
}

/**
 * A WebP with the TIFF bytes added as its details. A simple WebP gets the extended
 * header that says details follow, which needs the picture's size.
 */
export function webpWithDetails(
  webp: Uint8Array,
  tiff: Uint8Array,
  size: { width: number; height: number },
): Uint8Array {
  const pad = tiff.length % 2 ? new Uint8Array(1) : new Uint8Array(0);
  const exif = concat(bytesOf('EXIF'), u32(tiff.length, true), tiff, pad);
  let body = webp.subarray(12);
  const first = ascii(webp, 12, 4);
  if (first === 'VP8X') {
    body = body.slice();
    body[8] = body[8]! | 0x08;
  } else {
    const header = new Uint8Array(18);
    header.set(bytesOf('VP8X'));
    new DataView(header.buffer).setUint32(4, 10, true);
    // Says details follow, and for a lossless picture that it may be see-through.
    header[8] = 0x08 | (first === 'VP8L' ? 0x10 : 0);
    const w = size.width - 1;
    const h = size.height - 1;
    header.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 12);
    header.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 15);
    body = concat(header, body);
  }
  const content = concat(bytesOf('WEBP'), body, exif);
  return concat(bytesOf('RIFF'), u32(content.length, true), content);
}
