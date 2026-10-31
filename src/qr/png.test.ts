import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { palettePng, type PaletteColour } from './png';

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
