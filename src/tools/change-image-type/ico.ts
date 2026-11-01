// The ICO file: a small directory followed by one whole PNG per size. Browsers and
// Windows both open PNG pictures inside an ICO. Pure bytes, so Node tests can check it.

/** The sizes (in px) every ICO holds. 16 to 48 are for tabs, 256 is for Windows. */
export const iconSizes = [16, 32, 48, 256] as const;

export interface IconPicture {
  /** Width and height; icon pictures are square. */
  size: number;
  /** A whole PNG file. */
  png: Uint8Array;
}

const headerLength = 6;
const entryLength = 16;

/** Joins square PNG pictures (each 1 to 256 px) into one ICO file. */
export function makeIco(pictures: readonly IconPicture[]): Uint8Array<ArrayBuffer> {
  const total =
    headerLength + entryLength * pictures.length + pictures.reduce((n, p) => n + p.png.length, 0);
  const file = new Uint8Array(total);
  const view = new DataView(file.buffer);
  view.setUint16(2, 1, true); // an icon, not a cursor
  view.setUint16(4, pictures.length, true);
  let offset = headerLength + entryLength * pictures.length;
  pictures.forEach(({ size, png }, i) => {
    const at = headerLength + i * entryLength;
    // 256 does not fit in a byte, so the file says 0.
    file[at] = file[at + 1] = size === 256 ? 0 : size;
    view.setUint16(at + 4, 1, true); // colour planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, png.length, true);
    view.setUint32(at + 12, offset, true);
    file.set(png, offset);
    offset += png.length;
  });
  return file;
}
