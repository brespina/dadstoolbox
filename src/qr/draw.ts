// Draws a QR code in a Style, shared by the QR code Tools: the one place a code is drawn.
import { create } from 'qrcode';
import { palettePng, type PaletteColour } from './png';
import { codeParts, type Part, type RoundedSquare } from './shapes';
import { rgb, styleWarnings, type QrStyle } from './style';
import { svgBlob } from './svg';

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

/** A code that reads as `content`, drawn in `style`. */
export function drawQr(content: string, style: QrStyle): QrDrawing {
  let code;
  try {
    code = create(content, { errorCorrectionLevel: 'M' });
  } catch (error) {
    if (error instanceof Error && /too big/.test(error.message)) throw new TooLongForCode();
    throw error;
  }

  const { size, data } = code.modules;
  const total = size + margin * 2;
  const scale = Math.ceil(minimumWidth / total);
  const pixels = total * scale;
  const parts = codeParts(
    size,
    (row, col) => data[row * size + col] === 1,
    style.dotShape,
    style.cornerShape,
  );
  if (style.saveAs === 'svg') {
    return {
      blob: svgBlob({ parts, border: margin, total, pixels, style }),
      warnings: styleWarnings(style),
    };
  }
  const levels = paintParts(parts, pixels, scale);
  // Only the shades that appear get a palette colour: a code of square shapes has just
  // background and code, so it stays a 2-colour, 1-bit PNG.
  const used = [...new Set(levels)].sort((a, b) => a - b);
  const indexOf = new Map(used.map((shade, index) => [shade, index]));
  const blob = palettePng(pixels, shadePalette(style, used), (x, y) =>
    indexOf.get(levels[y * pixels + x]!)!,
  );
  return { blob, warnings: styleWarnings(style) };
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
