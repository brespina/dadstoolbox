// Painting Marks: each is a PNG with a see-through background, painted by the browser on
// a canvas (ADR-0007). `run` takes the painter as an argument, so Vitest passes a
// stand-in; the page tests cover this one. No libraries: the pad imports this too.

import { inks, padShape, type Ink, type Mark, type Options, type Stroke } from './declaration';

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

/** The browser's own painting: a drawn Signature, cropped to its ink. */
export const paintOnCanvas: PaintMark = async (_mark, { signature, ink }) => {
  const box = inkBox(signature.strokes);
  return {
    shape: box.width / box.height,
    paint: async (width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const drawing = canvas.getContext('2d')!;
      drawing.scale(width / box.width, height / box.height);
      drawing.translate(-box.left, -box.top);
      traceStrokes(drawing, signature.strokes, ink);
      return pngOf(canvas);
    },
  };
};
