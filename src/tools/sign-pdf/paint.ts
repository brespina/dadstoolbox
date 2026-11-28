// Painting Marks: each is a PNG with a see-through background, painted by the browser on
// a canvas (ADR-0007). `run` takes the painter as an argument, so Vitest passes a
// stand-in; the page tests cover this one. No libraries: the pad imports this too.

import {
  hasWords,
  inks,
  padShape,
  signatureFont,
  type Ink,
  type Mark,
  type Options,
  type Signature,
  type Stroke,
} from './declaration';
import { loadSignatureFont } from './signature-font';

/** A Mark's picture, before it is painted at a size. */
export interface MarkPicture {
  /** Its width ÷ its height. A Mark's height on the page always follows from this. */
  shape: number;
  /** The PNG, `width` × `height` pixels, see-through where there is no ink. */
  paint(width: number, height: number): Promise<Uint8Array>;
}

/** Gives a Mark's picture, from the Mark and the page's options (the Signature, the ink). */
export type PaintMark = (mark: Mark, options: Options) => Promise<MarkPicture>;

/** How thick a drawn line is, as a fraction of the pad's width. */
export const lineWidth = 0.012;

/** A point on the pad, in pad widths across and down (so the two use the same unit). */
const inPadWidths = ([x, y]: Stroke[number]) => [x, y / padShape] as const;

/**
 * Traces strokes as smooth curves (through the midpoints between points), in pad widths;
 * the caller's transform maps them to pixels. One point alone is a dot.
 */
export function traceStrokes(drawing: CanvasRenderingContext2D, strokes: Stroke[], ink: Ink) {
  drawing.strokeStyle = drawing.fillStyle = inks[ink];
  drawing.lineWidth = lineWidth;
  drawing.lineCap = drawing.lineJoin = 'round';
  for (const stroke of strokes) {
    const points = stroke.map(inPadWidths);
    const [first] = points;
    if (!first) continue;
    drawing.beginPath();
    drawing.moveTo(...first);
    if (points.length === 1) drawing.lineTo(...first);
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i]!;
      const [nextX, nextY] = points[i + 1]!;
      drawing.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
    }
    if (points.length > 1) drawing.lineTo(...points.at(-1)!);
    drawing.stroke();
  }
}

/** The box around the ink, in pad widths, with room for the line's own thickness. */
function inkBox(strokes: Stroke[]) {
  const points = strokes.flat().map(inPadWidths);
  if (points.length === 0) return { left: 0, top: 0, width: 1, height: 1 / padShape };
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs) - lineWidth;
  const top = Math.min(...ys) - lineWidth;
  return {
    left,
    top,
    width: Math.max(...xs) + lineWidth - left,
    height: Math.max(...ys) + lineWidth - top,
  };
}

/** A canvas's picture as PNG bytes, freeing the canvas's memory after. */
async function pngOf(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  // Phones have little memory to spare.
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error('The canvas gave no picture');
  return new Uint8Array(await blob.arrayBuffer());
}

/** The size words are measured and painted at, before they are scaled to the Mark. */
const fontSize = 100;
/** The device's own sans-serif, so any script the device can show is shown as typed. */
const wordsFont = `${fontSize}px system-ui, sans-serif`;
/**
 * A typed Signature's font, with the device's own after it: a letter the font lacks is
 * painted from the next one that has it.
 */
const signatureWordsFont = `${fontSize}px "${signatureFont}", system-ui, sans-serif`;
/** The shape of a Text Mark with no words yet: the dashed box it shows until there are. */
export const blankWordsShape = 4;
/** Words that read right to left, by their first letter (Hebrew, Arabic and the like). */
const readsRightToLeft = /^[^\p{L}]*[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u;

/** A canvas to measure words on, made once. */
let scratch: CanvasRenderingContext2D | undefined;

/** Sets a context up to measure or paint these words, so both do it the same way. */
function setUpWords(drawing: CanvasRenderingContext2D, words: string, font: string) {
  drawing.font = font;
  drawing.textBaseline = 'alphabetic';
  drawing.textAlign = 'left';
  drawing.direction = readsRightToLeft.test(words) ? 'rtl' : 'ltr';
}

/**
 * The box around the words, in font-size pixels from where they are drawn at the baseline:
 * the line's own height (so every line's letters are the same size), the full width of the
 * words, spaces included, with a little room either side for slanted letters.
 */
function wordsBox(words: string, font: string) {
  scratch ??= document.createElement('canvas').getContext('2d')!;
  setUpWords(scratch, words, font);
  const measured = scratch.measureText(words);
  const ascent = measured.fontBoundingBoxAscent ?? measured.actualBoundingBoxAscent;
  const descent = measured.fontBoundingBoxDescent ?? measured.actualBoundingBoxDescent;
  const room = fontSize * 0.1;
  const left = Math.min(0, -measured.actualBoundingBoxLeft) - room;
  const right = Math.max(measured.width, measured.actualBoundingBoxRight) + room;
  return { left, width: right - left, ascent, height: ascent + descent };
}

/**
 * A Mark's shape (width ÷ height) as its picture will have it, worked out at once so the
 * editor can lay a Mark out before its picture is painted. `run` gets the same number from
 * the picture itself. A Text Mark with no words, and a Signature not yet drawn, have a
 * shape of their own for their dashed box.
 */
export function shapeOf(mark: Mark, { signature }: Pick<Options, 'signature'>): number {
  if (mark.kind === 'text') {
    if (!hasWords(mark.text)) return blankWordsShape;
    const box = wordsBox(mark.text, wordsFont);
    return box.width / box.height;
  }
  if (signature.kind === 'typed') {
    if (!hasWords(signature.words)) return padShape;
    const box = wordsBox(signature.words, signatureWordsFont);
    return box.width / box.height;
  }
  const box = inkBox(signature.strokes);
  return box.width / box.height;
}

/** Paints words in the ink, the Mark's whole picture, `width` × `height` pixels. */
async function paintWords(
  words: string,
  font: string,
  ink: Ink,
  width: number,
  height: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const box = wordsBox(words, font);
  const drawing = canvas.getContext('2d')!;
  drawing.scale(width / box.width, height / box.height);
  drawing.translate(-box.left, box.ascent);
  setUpWords(drawing, words, font);
  drawing.fillStyle = inks[ink];
  drawing.fillText(words, 0, 0);
  return pngOf(canvas);
}

/** Paints the drawn Signature, cropped to its ink. */
async function paintStrokes(strokes: Stroke[], ink: Ink, width: number, height: number) {
  const box = inkBox(strokes);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const drawing = canvas.getContext('2d')!;
  drawing.scale(width / box.width, height / box.height);
  drawing.translate(-box.left, -box.top);
  traceStrokes(drawing, strokes, ink);
  return pngOf(canvas);
}

/** The picture's painting for a Signature: its strokes cropped to their ink, or its words. */
const paintSignature = (signature: Signature, ink: Ink, width: number, height: number) =>
  signature.kind === 'typed'
    ? paintWords(signature.words, signatureWordsFont, ink, width, height)
    : paintStrokes(signature.strokes, ink, width, height);

/**
 * The browser's own painting: a Text Mark's words, or the Signature (strokes cropped to
 * their ink, or words in the Signature's font). A typed Signature waits for its font
 * first, so its shape is measured in the real letters, not the device's stand-in.
 */
export const paintOnCanvas: PaintMark = async (mark, options) => {
  if (mark.kind === 'signature' && options.signature.kind === 'typed') await loadSignatureFont();
  return {
    shape: shapeOf(mark, options),
    paint: (width, height) =>
      mark.kind === 'text'
        ? paintWords(mark.text, wordsFont, options.ink, width, height)
        : paintSignature(options.signature, options.ink, width, height),
  };
};
