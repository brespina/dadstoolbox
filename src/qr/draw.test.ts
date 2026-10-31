import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { drawQr, TooLongForCode } from './draw';
import { plainStyle, type QrStyle } from './style';

/** The PNG's pixels, as [r, g, b, a] for each. */
async function pixels(blob: Blob) {
  const png = PNG.sync.read(Buffer.from(await blob.arrayBuffer()));
  const at = (x: number, y: number) => {
    const i = (y * png.width + x) * 4;
    return [...png.data.subarray(i, i + 4)];
  };
  return { png, at };
}

/**
 * Reads the code back to text with a reader that is not the Site's own, as it would look
 * on white paper: see-through pixels show the white behind them.
 */
async function readCode(blob: Blob) {
  const { png } = await pixels(blob);
  const rgba = new Uint8ClampedArray(png.data.length);
  for (let i = 0; i < png.data.length; i += 4) {
    const alpha = png.data[i + 3]! / 255;
    for (let c = 0; c < 3; c++) rgba[i + c] = png.data[i + c]! * alpha + 255 * (1 - alpha);
    rgba[i + 3] = 255;
  }
  return jsQR(rgba, png.width, png.height)?.data;
}

/** Every distinct colour in the PNG, as "r,g,b,a". */
async function colours(blob: Blob) {
  const { png } = await pixels(blob);
  const found = new Set<string>();
  for (let i = 0; i < png.data.length; i += 4) found.add([...png.data.subarray(i, i + 4)].join());
  return found;
}

const style = (changes: Partial<QrStyle>): QrStyle => ({ ...plainStyle, ...changes });

describe('the shared QR drawing', () => {
  it('draws the plain Style black on white, square and big enough to print', async () => {
    const { blob, warnings } = drawQr('hello', plainStyle);
    expect(blob.type).toBe('image/png');
    expect(warnings).toEqual([]);
    expect(await colours(blob)).toEqual(new Set(['0,0,0,255', '255,255,255,255']));
    const { png } = await pixels(blob);
    expect(png.width).toBe(png.height);
    expect(png.width).toBeGreaterThanOrEqual(720);
    expect(await readCode(blob)).toBe('hello');
  });

  it('draws the chosen code and background colours, and reads back', async () => {
    const { blob, warnings } = drawQr(
      'https://example.com/menu',
      style({ code: '#1a237e', background: '#fff59d' }),
    );
    expect(warnings).toEqual([]);
    expect(await colours(blob)).toEqual(new Set(['26,35,126,255', '255,245,157,255']));
    const { at } = await pixels(blob);
    // The top left corner is in the margin, so it is background.
    expect(at(0, 0)).toEqual([255, 245, 157, 255]);
    expect(await readCode(blob)).toBe('https://example.com/menu');
  });

  it('keeps a two-colour code small, at 1 bit a pixel', async () => {
    const { blob } = drawQr('hello', style({ code: '#1a237e', noBackground: true }));
    const { png } = await pixels(blob);
    expect(blob.size).toBeLessThan((png.width * png.height) / 8 + 2000);
  });

  it('leaves the background see-through with no background, and reads back on white', async () => {
    const { blob } = drawQr('Café crème ☕', style({ code: '#004d40', noBackground: true }));
    const found = await colours(blob);
    expect(found.has('0,77,64,255')).toBe(true);
    expect([...found].filter((c) => c.endsWith(',0'))).toHaveLength(1);
    const { at } = await pixels(blob);
    expect(at(0, 0)[3]).toBe(0);
    expect(await readCode(blob)).toBe('Café crème ☕');
  });

  it('notes that a code with no background needs a light one behind it', () => {
    expect(drawQr('hello', style({ noBackground: true })).warnings).toEqual([
      'Put this on a light background so phones can read it.',
    ]);
  });

  it.each([
    ['too close', '#777777', '#999999'],
    ['the code lighter than its background', '#ffffff', '#000000'],
    ['a light code on a slightly darker background', '#fff59d', '#ffeb3b'],
  ])('warns, but still draws, when the colours are %s', async (_case, code, background) => {
    const { blob, warnings } = drawQr('hello', style({ code, background }));
    expect(warnings).toEqual(['These colours may not scan.']);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('checks a code with no background against white, where it is meant to go', () => {
    expect(drawQr('hello', style({ code: '#eeeeee', noBackground: true })).warnings).toEqual([
      'These colours may not scan.',
      'Put this on a light background so phones can read it.',
    ]);
  });

  it.each([
    ['dark grey on white', '#555555', '#ffffff'],
    ['navy on pale yellow', '#1a237e', '#fff59d'],
    ['black on mid grey', '#000000', '#9e9e9e'],
  ])('gives no warning for %s', (_case, code, background) => {
    expect(drawQr('hello', style({ code, background })).warnings).toEqual([]);
  });

  it('throws TooLongForCode when the text is too long for one code', () => {
    expect(() => drawQr('a'.repeat(5000), plainStyle)).toThrow(TooLongForCode);
  });
});
