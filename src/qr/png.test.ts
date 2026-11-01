import { PNG } from 'pngjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { palettePng, rgbaPng, type PaletteColour } from './png';

async function read(blob: Blob) {
  return PNG.sync.read(Buffer.from(await blob.arrayBuffer()));
}

describe('the palette PNG writer', () => {
  it.each([1, 2, 3, 4, 5, 17, 100, 256])(
    'draws every colour of a %i-colour palette, with its see-through',
    async (count) => {
      const palette: PaletteColour[] = Array.from({ length: count }, (_, i) => [
        i,
        255 - i,
        (i * 7) % 256,
        i % 3 === 0 ? 0 : 255,
      ]);
      // A width that is not a whole number of bytes at any depth.
      const width = 13;
      const blob = palettePng(width, palette, (x, y) => (x + y * width) % count);
      const png = await read(blob);
      expect(png.width).toBe(width);
      for (let y = 0; y < width; y++) {
        for (let x = 0; x < width; x++) {
          const [r, g, b, a] = palette[(x + y * width) % count]!;
          const i = (y * width + x) * 4;
          expect([...png.data.subarray(i, i + 4)]).toEqual([r, g, b, a]);
        }
      }
    },
  );

  it('refuses a palette that is empty or holds more than 256', () => {
    expect(() => palettePng(4, [], () => 0)).toThrow();
    expect(() => palettePng(4, Array(257).fill([0, 0, 0, 255]), () => 0)).toThrow();
  });
});

describe('the full-colour PNG writer', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A square of a flat colour with a see-through stripe, like a logo on a code. */
  const picture = (width: number) => {
    const rgba = new Uint8Array(width * width * 4);
    for (let i = 0; i < rgba.length; i += 4)
      rgba.set(i % 7 === 0 ? [9, 8, 7, 0] : [200, 10, 20, 255], i);
    return rgba;
  };

  it('writes every pixel with its see-through', async () => {
    const rgba = picture(13);
    const png = await read(await rgbaPng(13, rgba));
    expect(png.width).toBe(13);
    expect([...png.data]).toEqual([...rgba]);
  });

  it('compresses a flat picture where the browser can', async () => {
    const blob = await rgbaPng(300, picture(300));
    expect(blob.size).toBeLessThan((300 * 300 * 4) / 10);
  });

  it('stores the pixels, still valid, where the browser has no compression', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const rgba = picture(40);
    const blob = await rgbaPng(40, rgba);
    expect(blob.size).toBeGreaterThan(40 * 40 * 4);
    expect([...(await read(blob)).data]).toEqual([...rgba]);
  });

  it('refuses pixels that do not fit the size', async () => {
    await expect(rgbaPng(4, new Uint8Array(10))).rejects.toThrow();
  });
});
