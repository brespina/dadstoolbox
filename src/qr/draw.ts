// Draws a QR code in a Style, shared by the QR code Tools: the one place a code is drawn.
import { create } from 'qrcode';
import { sizeSvg } from '../photos/svg';
import { fileTypeOf } from '../tools/file-type';
import { paintLogoOnCanvas } from './paint-logo';
import { palettePng, rgbaPng, type PaletteColour } from './png';
import { codeParts, logoPlace, type LogoPlace, type Part, type RoundedSquare } from './shapes';
import { rgb, styleWarnings, type QrStyle } from './style';
import { svgBlob, type SvgLogo } from './svg';

/** The border around the code, in squares. Scanners need at least 4. */
const margin = 4;
/** Pictures are at least this many pixels wide, so they print sharply. */
const minimumWidth = 720;
/** How many shades a rounded edge is drawn in, from background to code: 16 fit 4 bits. */
const edgeShades = 16;
/**
 * A see-through pixel. Its colour is white, so an app that ignores see-through shows
 * white, where the code still reads.
 */
const seeThrough: PaletteColour = [255, 255, 255, 0];

/** Thrown when the text is too long for one code. Each Tool turns it into its own reason. */
export class TooLongForCode extends Error {
  constructor() {
    super('The text is too long for one QR code');
    this.name = 'TooLongForCode';
  }
}

/** A drawn code, and the notes to show under it. */
export interface QrDrawing {
  /** The code, as a PNG or an SVG, as the Style says. */
  blob: Blob;
  /** Notes under the code, such as colours that may not scan. They never stop it. */
  warnings: string[];
}

/** Thrown when the logo is not a picture the browser can open. Each Tool turns it into its own reason. */
export class LogoNotOpened extends Error {
  constructor(cause: unknown) {
    super('The logo could not be opened', { cause });
    this.name = 'LogoNotOpened';
  }
}

/**
 * Draws the logo's pixels on a see-through square `side` wide, fitted whole and centred:
 * red, green, blue and alpha for each pixel, row by row. The browser's canvas does it;
 * tests pass a stand-in.
 */
export type PaintLogo = (logo: File, side: number) => Promise<Uint8ClampedArray>;

/**
 * A code with a logo is at least version 2 (25 squares wide), so the logo is at least 4
 * squares wide. Version 1 would leave room for only 2.
 */
const leastLogoVersion = 2;

/**
 * The code's squares for `content`. A logo hides some of them, so a code with one uses
 * the strongest error correction (H), which holds less text; without one it keeps M.
 */
function makeCode(content: string, hasLogo: boolean) {
  const errorCorrectionLevel = hasLogo ? 'H' : 'M';
  try {
    const code = create(content, { errorCorrectionLevel });
    return hasLogo && code.version < leastLogoVersion
      ? create(content, { errorCorrectionLevel, version: leastLogoVersion })
      : code;
  } catch (error) {
    if (error instanceof Error && /too big/.test(error.message)) throw new TooLongForCode();
    throw error;
  }
}

/** A code that reads as `content`, drawn in `style`. `paintLogo` draws the logo, if any. */
export async function drawQr(
  content: string,
  style: QrStyle,
  paintLogo: PaintLogo = paintLogoOnCanvas,
): Promise<QrDrawing> {
  const { size, data } = makeCode(content, style.logo !== null).modules;
  const total = size + margin * 2;
  const scale = Math.ceil(minimumWidth / total);
  const pixels = total * scale;
  const place = style.logo ? logoPlace(size) : undefined;
  // No dots under the logo's patch.
  const parts = codeParts(
    size,
    (row, col) => data[row * size + col] === 1 && !place?.covers(row, col),
    style.dotShape,
    style.cornerShape,
  );
  const warnings = styleWarnings(style);
  if (style.saveAs === 'svg') {
    const logo =
      style.logo && place
        ? await svgLogo(paintLogo, style, style.logo, place, pixels / total)
        : undefined;
    return { blob: svgBlob({ parts, border: margin, total, pixels, style, logo }), warnings };
  }
  const levels = paintParts(parts, pixels, scale);
  if (style.logo && place) {
    const logo = await logoPixels(paintLogo, style.logo, Math.round(place.logo.size * scale));
    return { blob: await pngWithLogo(levels, pixels, scale, style, place, logo), warnings };
  }
  // Only the shades that appear get a palette colour: a code of square shapes has just
  // background and code, so it stays a 2-colour, 1-bit PNG.
  const used = [...new Set(levels)].sort((a, b) => a - b);
  const indexOf = new Map(used.map((shade, index) => [shade, index]));
  const blob = palettePng(pixels, shadePalette(style, used), (x, y) =>
    indexOf.get(levels[y * pixels + x]!)!,
  );
  return { blob, warnings };
}

/** The logo drawn `side` pixels wide, or LogoNotOpened. */
async function logoPixels(paintLogo: PaintLogo, logo: File, side: number) {
  try {
    return await paintLogo(logo, side);
  } catch (error) {
    throw new LogoNotOpened(error);
  }
}

/**
 * The patch under a logo, as "#rrggbb": the background colour, or white when there is
 * none, so the logo and the code around it still read on any surface.
 */
function patchColour(style: QrStyle) {
  return style.noBackground ? '#ffffff' : style.background;
}

/** A raster logo in an SVG has twice the pixels the file's stated size needs, so it stays sharp zoomed in. */
const svgLogoDetail = 2;

/**
 * The logo for an SVG code, held inside the file. An SVG logo is kept as it is, so it
 * stays sharp at any size; any other is drawn and held as a PNG, so a big photo doesn't
 * make a big file.
 */
async function svgLogo(
  paintLogo: PaintLogo,
  style: QrStyle,
  logo: File,
  place: LogoPlace,
  pixelsPerSquare: number,
): Promise<SvgLogo> {
  const side = Math.ceil(place.logo.size * pixelsPerSquare * svgLogoDetail);
  // Drawn even for an SVG logo, so one that won't open fails here as it does in a PNG.
  const drawn = await logoPixels(paintLogo, logo, side);
  const href =
    fileTypeOf(logo) === 'image/svg+xml'
      ? // Sized, so a logo that states no size still fills its box.
        dataAddress('image/svg+xml', new TextEncoder().encode(sizeSvg(await logo.text()).markup))
      : dataAddress('image/png', new Uint8Array(await (await rgbaPng(side, drawn)).arrayBuffer()));
  return { patch: place.patch, patchColour: patchColour(style), box: place.logo, href };
}

/** Bytes as a data address ("data:<type>;base64,..."), which holds them inside a file. */
function dataAddress(type: string, bytes: Uint8Array) {
  let binary = '';
  // In parts, as one call with millions of arguments would overflow the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

/**
 * The code in full colour, with the logo on its patch in the middle. The logo's own
 * see-through parts show the patch.
 */
function pngWithLogo(
  levels: Uint8Array,
  pixels: number,
  scale: number,
  style: QrStyle,
  place: LogoPlace,
  logo: Uint8ClampedArray,
): Promise<Blob> {
  const palette = shadePalette(
    style,
    Array.from({ length: edgeShades }, (_, shade) => shade),
  );
  const rgba = new Uint8ClampedArray(pixels * pixels * 4);
  levels.forEach((shade, i) => rgba.set(palette[shade]!, i * 4));

  const toPixel = (squares: number) => Math.round((squares + margin) * scale);
  const patch = [...rgb(patchColour(style)), 255];
  const patchStart = toPixel(place.patch.x);
  const patchEnd = toPixel(place.patch.x + place.patch.size);
  for (let y = patchStart; y < patchEnd; y++) {
    for (let x = patchStart; x < patchEnd; x++) rgba.set(patch, (y * pixels + x) * 4);
  }

  // The logo over the solid patch: each pixel blends by the logo's alpha.
  const side = Math.round(place.logo.size * scale);
  const logoStart = toPixel(place.logo.x);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const from = (y * side + x) * 4;
      const to = ((logoStart + y) * pixels + logoStart + x) * 4;
      const alpha = logo[from + 3]! / 255;
      for (let c = 0; c < 3; c++) {
        rgba[to + c] = logo[from + c]! * alpha + rgba[to + c]! * (1 - alpha);
      }
    }
  }
  return rgbaPng(pixels, rgba);
}

/** The palette colours of a Style for these shades: 0 is all background, `edgeShades - 1` all code. */
function shadePalette(style: QrStyle, used: readonly number[]): PaletteColour[] {
  const code = rgb(style.code);
  const background = rgb(style.background);
  return used.map((shade): PaletteColour => {
    const codeShare = shade / (edgeShades - 1);
    if (style.noBackground) {
      // The edge keeps the code's colour and gets more see-through, so it blends into
      // whatever the code is put on.
      return shade === 0 ? seeThrough : [...code, Math.round(codeShare * 255)];
    }
    const blend = (i: number) =>
      Math.round(background[i]! + (code[i]! - background[i]!) * codeShare);
    return [blend(0), blend(1), blend(2), 255];
  });
}

/**
 * How much of each pixel the parts cover, as a shade from 0 (none) to `edgeShades - 1`
 * (all), row by row. The parts are in squares from the code's top left, `scale` pixels each,
 * inside the border.
 */
function paintParts(parts: readonly Part[], pixels: number, scale: number) {
  const levels = new Uint8Array(pixels * pixels);
  const shift = margin * scale;
  for (const { outer, hole } of parts) {
    const x0 = Math.max(0, Math.floor(outer.x * scale + shift));
    const x1 = Math.min(pixels, Math.ceil((outer.x + outer.size) * scale + shift));
    const y0 = Math.max(0, Math.floor(outer.y * scale + shift));
    const y1 = Math.min(pixels, Math.ceil((outer.y + outer.size) * scale + shift));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        // The pixel's middle, in squares from the code's top left.
        const px = (x + 0.5 - shift) / scale;
        const py = (y + 0.5 - shift) / scale;
        let covered = coverage(outer, px, py, scale);
        if (hole) covered *= 1 - coverage(hole, px, py, scale);
        const shade = Math.round(covered * (edgeShades - 1));
        if (shade > levels[y * pixels + x]!) levels[y * pixels + x] = shade;
      }
    }
  }
  return levels;
}

/**
 * How much of a pixel (0 to 1) a rounded square covers, from the distance of the pixel's
 * middle to the square's edge: pixels on the edge are part covered, which smooths it.
 */
function coverage(shape: RoundedSquare, px: number, py: number, scale: number) {
  const half = shape.size / 2;
  // Distance past the straight sides, towards the rounded corners.
  const dx = Math.abs(px - (shape.x + half)) - (half - shape.radius);
  const dy = Math.abs(py - (shape.y + half)) - (half - shape.radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  const distance = outside + inside - shape.radius; // negative inside the shape
  return Math.min(1, Math.max(0, 0.5 - distance * scale));
}
