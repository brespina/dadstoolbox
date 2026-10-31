import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { describe, expect, it, vi } from 'vitest';
import { drawQr, TooLongForCode, type PaintLogo } from './draw';
import { plainStyle, shapeNames, type QrStyle } from './style';

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

// Reading a 700 px code back with jsQR takes seconds on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

const style = (changes: Partial<QrStyle>): QrStyle => ({ ...plainStyle, ...changes });

describe('the shared QR drawing', () => {
  it('draws the plain Style black on white, square and big enough to print', async () => {
    const { blob, warnings } = await drawQr('hello', plainStyle);
    expect(blob.type).toBe('image/png');
    expect(warnings).toEqual([]);
    expect(await colours(blob)).toEqual(new Set(['0,0,0,255', '255,255,255,255']));
    const { png } = await pixels(blob);
    expect(png.width).toBe(png.height);
    expect(png.width).toBeGreaterThanOrEqual(720);
    expect(await readCode(blob)).toBe('hello');
  });

  it('draws the chosen code and background colours, and reads back', async () => {
    const { blob, warnings } = await drawQr(
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
    const { blob } = await drawQr('hello', style({ code: '#1a237e', noBackground: true }));
    const { png } = await pixels(blob);
    expect(blob.size).toBeLessThan((png.width * png.height) / 8 + 2000);
  });

  it('leaves the background see-through with no background, and reads back on white', async () => {
    const { blob } = await drawQr('Café crème ☕', style({ code: '#004d40', noBackground: true }));
    const found = await colours(blob);
    expect(found.has('0,77,64,255')).toBe(true);
    expect([...found].filter((c) => c.endsWith(',0'))).toHaveLength(1);
    const { at } = await pixels(blob);
    expect(at(0, 0)[3]).toBe(0);
    expect(await readCode(blob)).toBe('Café crème ☕');
  });

  it('notes that a code with no background needs a light one behind it', async () => {
    expect((await drawQr('hello', style({ noBackground: true }))).warnings).toEqual([
      'Put this on a light background so phones can read it.',
    ]);
  });

  it.each([
    ['too close', '#777777', '#999999'],
    ['the code lighter than its background', '#ffffff', '#000000'],
    ['a light code on a slightly darker background', '#fff59d', '#ffeb3b'],
  ])('warns, but still draws, when the colours are %s', async (_case, code, background) => {
    const { blob, warnings } = await drawQr('hello', style({ code, background }));
    expect(warnings).toEqual(['These colours may not scan.']);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('checks a code with no background against white, where it is meant to go', async () => {
    expect(
      (await drawQr('hello', style({ code: '#eeeeee', noBackground: true }))).warnings,
    ).toEqual([
      'These colours may not scan.',
      'Put this on a light background so phones can read it.',
    ]);
  });

  it.each([
    ['dark grey on white', '#555555', '#ffffff'],
    ['navy on pale yellow', '#1a237e', '#fff59d'],
    ['black on mid grey', '#000000', '#9e9e9e'],
  ])('gives no warning for %s', async (_case, code, background) => {
    expect((await drawQr('hello', style({ code, background }))).warnings).toEqual([]);
  });

  describe('dot and corner shapes', () => {
    const combos = shapeNames.flatMap((dotShape) =>
      shapeNames.map((cornerShape) => [dotShape, cornerShape] as const),
    );

    it.each(combos)('reads back with %s dots and %s corners', async (dotShape, cornerShape) => {
      const shaped = style({ dotShape, cornerShape });
      for (const typed of ['hello', 'https://example.com/menu?table=4', 'Café crème ☕ for Zoë']) {
        expect(await readCode((await drawQr(typed, shaped)).blob)).toBe(typed);
      }
    });

    it('reads back at a long text too, with the biggest dots to place', async () => {
      const typed = 'Wi-Fi password: garden shed 42. '.repeat(12);
      const shaped = style({ dotShape: 'round', cornerShape: 'round' });
      expect(await readCode((await drawQr(typed, shaped)).blob)).toBe(typed);
    });

    it('reads back with colours', async () => {
      const shaped = style({
        dotShape: 'round',
        cornerShape: 'rounded',
        code: '#1a237e',
        background: '#fff59d',
      });
      expect(await readCode((await drawQr('hello', shaped)).blob)).toBe('hello');
    });

    it('reads back with no background, and keeps the background see-through around the edges', async () => {
      const shaped = style({ dotShape: 'round', cornerShape: 'round', noBackground: true });
      const { blob } = await drawQr('hello', shaped);
      expect(await readCode(blob)).toBe('hello');
      const { png, at } = await pixels(blob);
      expect(at(0, 0)).toEqual([255, 255, 255, 0]);
      // Edges are partly see-through code colour, not white or black pixels.
      const partial = new Set<number>();
      for (let i = 3; i < png.data.length; i += 4) {
        const a = png.data[i]!;
        if (a > 0 && a < 255) {
          partial.add(a);
          // A see-through edge keeps the code's colour.
          expect([...png.data.subarray(i - 3, i)]).toEqual([0, 0, 0]);
        }
      }
      expect(partial.size).toBeGreaterThanOrEqual(8);
    });

    it('blends the edges between code and background colours, so they look smooth', async () => {
      const { blob } = await drawQr('hello', style({ dotShape: 'round', cornerShape: 'round' }));
      expect((await colours(blob)).size).toBeGreaterThanOrEqual(8);
    });

    it('draws the square shapes exactly as before, in two colours', async () => {
      const { blob } = await drawQr('hello', style({ dotShape: 'square', cornerShape: 'square' }));
      expect((await colours(blob)).size).toBe(2);
    });

    it('draws a round dot as a circle, with its corners left as background', async () => {
      // A lone dark module's corner is background when round, code when square.
      const round = style({ dotShape: 'round', cornerShape: 'square' });
      const square = style({ dotShape: 'square', cornerShape: 'square' });
      // The 8x8 finder area aside, the format-information dark module sits at row 4v+9.
      // v1 (21 modules): row 13, column 8; margin 4; scale = ceil(720 / 29) = 25.
      const scale = 25;
      const x = (8 + 4) * scale;
      const y = (13 + 4) * scale;
      const dark = await pixels((await drawQr('hello', square)).blob);
      const dot = await pixels((await drawQr('hello', round)).blob);
      expect(dark.at(x, y)).toEqual([0, 0, 0, 255]);
      expect(dot.at(x, y)).toEqual([255, 255, 255, 255]);
      expect(dot.at(x + 12, y + 12)).toEqual([0, 0, 0, 255]);
    });

    it('rounds the outer corner of the big corner squares, and only for rounded and round', async () => {
      // The pixel just inside the top left corner of the first big corner square.
      const at = async (cornerShape: 'square' | 'rounded' | 'round') =>
        (await pixels((await drawQr('hello', style({ cornerShape }))).blob)).at(
          4 * 25 + 1,
          4 * 25 + 1,
        );
      expect(await at('square')).toEqual([0, 0, 0, 255]);
      expect(await at('rounded')).toEqual([255, 255, 255, 255]);
      expect(await at('round')).toEqual([255, 255, 255, 255]);
    });

    it('draws a round corner with the finder rings still one module thick on the middle row', async () => {
      const { blob } = await drawQr('hello', style({ cornerShape: 'round' }));
      const { at } = await pixels(blob);
      const scale = 25;
      const row = (4 + 3.5) * scale;
      // dark ring, light ring, dark centre, light ring, dark ring across the finder.
      const runs = [0, 1, 2, 3, 4, 5, 6].map((m) => at((4 + m) * scale + 12, Math.floor(row))[0]);
      expect(runs).toEqual([0, 255, 0, 0, 0, 255, 0]);
    });
  });

  describe('saving as SVG', () => {
    const svgStyle = (changes: Partial<QrStyle> = {}) => style({ saveAs: 'svg', ...changes });
    const svgText = async (changes: Partial<QrStyle> = {}, typed = 'hello') =>
      (await drawQr(typed, svgStyle(changes))).blob.text();

    it('saves as PNG unless SVG is chosen', async () => {
      expect(plainStyle.saveAs).toBe('png');
      expect((await drawQr('hello', plainStyle)).blob.type).toBe('image/png');
    });

    it('draws a standalone SVG file, with a size so a picture of it has one', async () => {
      const { blob, warnings } = await drawQr('hello', svgStyle());
      expect(blob.type).toBe('image/svg+xml');
      expect(warnings).toEqual([]);
      const svg = await blob.text();
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /);
      // Version 1 is 21 squares, and the border adds 4 on each side: 29 squares.
      expect(svg).toContain('viewBox="0 0 29 29"');
      const width = Number(/ width="(\d+)"/.exec(svg)![1]);
      expect(width).toBeGreaterThanOrEqual(720);
      expect(svg).toContain(` height="${width}"`);
      // Nothing it needs from outside the file.
      expect(svg).not.toMatch(/<script|<image|href=|<style|@import|<\?xml-stylesheet/);
      expect(svg.trim().endsWith('</svg>')).toBe(true);
    });

    it('draws the code and background colours, and leaves out the background when none', async () => {
      const coloured = await svgText({ code: '#1a237e', background: '#fff59d' });
      expect(coloured).toMatch(/<rect [^>]*width="29" height="29" fill="#fff59d"/);
      expect(coloured).toMatch(/<path [^>]*fill="#1a237e"/);
      expect(coloured).not.toContain('#000000');

      const none = await svgText({ code: '#004d40', noBackground: true, background: '#fff59d' });
      expect(none).not.toContain('<rect');
      expect(none).not.toContain('#fff59d');
      expect(none).toMatch(/<path [^>]*fill="#004d40"/);
    });

    it('gives the same warnings as the PNG', async () => {
      expect((await drawQr('hello', svgStyle({ noBackground: true }))).warnings).toEqual([
        'Put this on a light background so phones can read it.',
      ]);
      expect((await drawQr('hello', svgStyle({ code: '#ffeb3b' }))).warnings).toEqual([
        'These colours may not scan.',
      ]);
    });

    it('draws the shapes as curves, and square shapes as straight lines only', async () => {
      const square = await svgText();
      expect(square).not.toMatch(/ d="[^"]*a/);
      expect(square).toContain('crispEdges');
      for (const changes of [{ dotShape: 'round' }, { cornerShape: 'rounded' }] as const) {
        const shaped = await svgText(changes);
        expect(shaped).toMatch(/ d="[^"]*a/);
        expect(shaped).not.toContain('crispEdges');
      }
    });

    it('grows with the text, and cuts rings out by the even-odd rule', async () => {
      const short = await svgText({}, 'hi');
      const long = await svgText({}, 'https://example.com/menu?table=4');
      expect(short).toContain('fill-rule="evenodd"');
      expect(long.length).toBeGreaterThan(short.length);
      expect(long).toContain('viewBox="0 0 37 37"');
    });

    it('still throws TooLongForCode', async () => {
      await expect(drawQr('a'.repeat(5000), svgStyle())).rejects.toThrow(TooLongForCode);
    });
  });

  describe('a logo in the middle', () => {
    /** A chosen logo. The stand-in painter never reads it. */
    const logoFile = new File(['logo'], 'logo.png', { type: 'image/png' });
    const red = [220, 0, 0, 255];
    /** Stands in for the browser drawing the logo: a solid red square as big as asked. */
    const paintRed: PaintLogo = async (_logo, side) => {
      const rgba = new Uint8ClampedArray(side * side * 4);
      for (let i = 0; i < rgba.length; i += 4) rgba.set(red, i);
      return rgba;
    };
    const withLogo = (changes: Partial<QrStyle> = {}) => style({ logo: logoFile, ...changes });

    it.each([
      ['square shapes', {}],
      ['round dots and rounded corners', { dotShape: 'round', cornerShape: 'rounded' }],
      ['rounded shapes and no background', { dotShape: 'rounded', noBackground: true }],
      ['colours', { code: '#1a237e', background: '#fff59d' }],
    ] as const)('reads back with %s', async (_case, changes) => {
      for (const typed of ['hello', 'https://example.com/menu?table=4', 'Café crème ☕ for Zoë']) {
        const { blob } = await drawQr(typed, withLogo(changes), paintRed);
        const { png, at } = await pixels(blob);
        const middle = Math.floor(png.width / 2);
        expect(at(middle, middle)).toEqual(red);
        expect(await readCode(blob)).toBe(typed);
      }
    });
  });

  it('throws TooLongForCode when the text is too long for one code', async () => {
    await expect(drawQr('a'.repeat(5000), plainStyle)).rejects.toThrow(TooLongForCode);
  });
});
