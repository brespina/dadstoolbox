// A tiny PNG writer, so `run` needs no canvas and works the same in the browser and in
// plain Node. Most codes are a few colours: each pixel is an index into a palette of up to
// 256 colours, any of them see-through, so a two-colour code takes 1 bit a pixel. A code
// with a logo has the logo's colours too, so it is written in full colour. Pixels
// are stored without compression: CompressionStream would shrink them, but Safari only
// has it from 16.4.

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Wraps bytes in a zlib stream of stored (uncompressed) blocks. */
function zlibStored(raw: Uint8Array) {
  const blockSize = 0xffff;
  const blocks = Math.max(1, Math.ceil(raw.length / blockSize));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  const view = new DataView(out.buffer);
  out[0] = 0x78;
  out[1] = 0x01;
  let at = 2;
  for (let i = 0; i < blocks; i++) {
    const part = raw.subarray(i * blockSize, (i + 1) * blockSize);
    out[at] = i === blocks - 1 ? 1 : 0;
    view.setUint16(at + 1, part.length, true);
    view.setUint16(at + 3, ~part.length & 0xffff, true);
    out.set(part, at + 5);
    at += 5 + part.length;
  }
  view.setUint32(at, adler32(raw));
  return out;
}

/** A palette colour: red, green, blue and alpha (0 is see-through), each 0 to 255. */
export type PaletteColour = readonly [number, number, number, number];

/**
 * A square PNG `pixels` wide, each pixel coloured from `palette` by its index. Up to 256
 * colours; with 2, as a plain code has, each pixel takes 1 bit, so the file stays small.
 */
export function palettePng(
  pixels: number,
  palette: readonly PaletteColour[],
  indexAt: (x: number, y: number) => number,
): Blob {
  if (palette.length < 1 || palette.length > 256) throw new Error('A palette holds 1 to 256');
  const depth = [1, 2, 4, 8].find((bits) => palette.length <= 2 ** bits)!;
  const perByte = 8 / depth;
  const rowBytes = Math.ceil(pixels / perByte);
  const raw = new Uint8Array((rowBytes + 1) * pixels);
  for (let y = 0; y < pixels; y++) {
    const start = y * (rowBytes + 1) + 1; // the first byte of each row is filter 0
    for (let x = 0; x < pixels; x++) {
      // The leftmost pixel takes the highest bits of its byte.
      const shift = 8 - depth * ((x % perByte) + 1);
      raw[start + Math.floor(x / perByte)]! |= indexAt(x, y) << shift;
    }
  }

  return pngFile(pixels, depth, colourTypes.palette, raw, [
    chunk('PLTE', new Uint8Array(palette.flatMap(([r, g, b]) => [r, g, b]))),
    // Each palette colour's alpha, left out when every colour is solid.
    ...(palette.some(([, , , a]) => a < 255)
      ? [chunk('tRNS', new Uint8Array(palette.map(([, , , a]) => a)))]
      : []),
  ]);
}

/**
 * A square PNG `pixels` wide in full colour, from its pixels row by row as red, green,
 * blue and alpha (0 is see-through), 4 bytes each. Bigger than a palette PNG, so only a
 * picture of many colours, such as a code with a logo, uses it.
 */
export function rgbaPng(pixels: number, rgba: Uint8Array | Uint8ClampedArray): Blob {
  if (rgba.length !== pixels * pixels * 4) throw new Error('The pixels do not fit the size');
  const rowBytes = pixels * 4;
  const raw = new Uint8Array((rowBytes + 1) * pixels);
  // The first byte of each row is filter 0.
  for (let y = 0; y < pixels; y++) {
    raw.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  }
  return pngFile(pixels, 8, colourTypes.rgba, raw, []);
}

/** The PNG colour types written here. */
const colourTypes = { palette: 3, rgba: 6 };

/** A square PNG `pixels` wide: its header, its colour chunks (if any) and its pixels. */
function pngFile(
  pixels: number,
  depth: number,
  colourType: number,
  raw: Uint8Array,
  colours: Uint8Array[],
) {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, pixels);
  view.setUint32(4, pixels);
  header[8] = depth;
  header[9] = colourType;

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [
    signature,
    chunk('IHDR', header),
    ...colours,
    chunk('IDAT', zlibStored(raw)),
    chunk('IEND', new Uint8Array()),
  ];
  return new Blob(parts as Uint8Array<ArrayBuffer>[], { type: 'image/png' });
}
