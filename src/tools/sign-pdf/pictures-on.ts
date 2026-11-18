// For tests only (run.test.ts and the page test): where each picture is drawn on a page
// of a saved PDF, read from the page's own drawing instructions.

import { decodePDFRawStream, PDFArray, type PDFPage, type PDFRawStream } from 'pdf-lib';

type Matrix = [number, number, number, number, number, number];

/** The matrix `first` then `then`, as PDF's `cm` joins them. */
const times = ([a, b, c, d, e, f]: Matrix, [A, B, C, D, E, F]: Matrix): Matrix => [
  a * A + b * C,
  a * B + b * D,
  c * A + d * C,
  c * B + d * D,
  e * A + f * C + E,
  e * B + f * D + F,
];

/** One drawn picture: the box it covers on the page, in PDF points, and its turn. */
export interface DrawnPicture {
  /** The box's lower-left corner and size, in the page's own points. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** How far the picture is turned, anticlockwise, in degrees from 0 to 359. */
  turn: number;
}

/** Every picture drawn on the page, in drawing order. */
export function picturesOn(page: PDFPage): DrawnPicture[] {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  const code = streams
    .map((ref) => page.doc.context.lookup(ref) as PDFRawStream)
    .map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode()))
    .join('\n');
  // Follow the drawing state through q, Q and cm, and note it at each Do.
  let now: Matrix = [1, 0, 0, 1, 0, 0];
  const saved: Matrix[] = [];
  const numbers: number[] = [];
  const found: DrawnPicture[] = [];
  for (const token of code.split(/\s+/)) {
    if (/^-?[\d.]+$/.test(token)) {
      numbers.push(Number(token));
      continue;
    }
    if (token === 'q') saved.push(now);
    if (token === 'Q') now = saved.pop()!;
    if (token === 'cm') now = times(numbers.slice(-6) as Matrix, now);
    if (token === 'Do') {
      // A picture fills the unit square, so its corners show where it lands.
      const [a, b, c, d, e, f] = now;
      const xs = [e, a + e, c + e, a + c + e];
      const ys = [f, b + f, d + f, b + d + f];
      found.push({
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        turn: Math.round(((Math.atan2(b, a) * 180) / Math.PI + 360) % 360),
      });
    }
    numbers.length = 0;
  }
  return found;
}
