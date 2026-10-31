// A tiny PNG writer for black-and-white pictures, so `run` needs no canvas and works the
// same in the browser and in plain Node. Pixels are 1 bit each and stored without
// compression: CompressionStream would shrink them, but Safari only has it from 16.4.

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

/** A PNG of a square grid `size` squares wide, each square `scale` pixels wide. */
export function blackAndWhitePng(
  size: number,
  isBlack: (row: number, col: number) => boolean,
  scale: number,
): Blob {
  const pixels = size * scale;
  const rowBytes = Math.ceil(pixels / 8);
  const raw = new Uint8Array((rowBytes + 1) * pixels);
  for (let y = 0; y < pixels; y++) {
    const start = y * (rowBytes + 1) + 1; // the first byte of each row is filter 0
    for (let x = 0; x < pixels; x++) {
      // In 1-bit greyscale, 1 is white.
      if (!isBlack(Math.floor(y / scale), Math.floor(x / scale))) {
        raw[start + (x >> 3)]! |= 0x80 >> (x & 7);
      }
    }
  }

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, pixels);
  view.setUint32(4, pixels);
  header[8] = 1; // bit depth
  header[9] = 0; // greyscale

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [
    signature,
    chunk('IHDR', header),
    chunk('IDAT', zlibStored(raw)),
    chunk('IEND', new Uint8Array()),
  ];
  return new Blob(parts as Uint8Array<ArrayBuffer>[], { type: 'image/png' });
}
