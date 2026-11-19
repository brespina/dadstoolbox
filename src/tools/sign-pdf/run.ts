// The Tool's job: draw each Mark's picture on its page and save the PDF again. pdf.js is
// never imported here: it loads only inside the page editor (ADR-0006).

import { degrees, PDFNumber, type PDFArray, type PDFDocument, type PDFPage } from 'pdf-lib';
import type { ToolRun } from '../types';
import { openToSign } from './can-sign';
import type { Mark, Options } from './declaration';
import { keepInside } from './marks';
import { placeOnPage, shownSize, type PageBoxes } from './page-geometry';
import { paintOnCanvas, type PaintMark } from './paint';

/** Marks are painted at this many dots an inch of their size on the page (ADR-0007)… */
const dotsPerInch = 300;
/** …with no side longer than this, in pixels. */
const longestSide = 2000;
/** PDF points in an inch. */
const pointsPerInch = 72;

/** A box as the page holds it, its numbers followed through any references. */
function numbersIn(read: () => PDFArray | undefined): number[] | undefined {
  try {
    const array = read();
    return array?.asArray().map((_, i) => array.lookupMaybe(i, PDFNumber)?.asNumber() ?? NaN);
  } catch {
    // A box that points at nothing is as good as none (as pdf.js sees it).
    return undefined;
  }
}

/** What the page says about its own shape, inherited from the page tree as pdf.js does. */
function boxesOf(page: PDFPage): PageBoxes {
  return {
    mediaBox: numbersIn(() => page.node.MediaBox()),
    cropBox: numbersIn(() => page.node.CropBox()),
    rotate: page.node.Rotate()?.asNumber(),
  };
}

/** The picture's size in pixels for a place on the page `width` × `height` points. */
function pixelsFor(width: number, height: number) {
  const scale = Math.min(dotsPerInch / pointsPerInch, longestSide / Math.max(width, height));
  // At least a pixel each way, so a very small Mark still paints.
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function drawMark(doc: PDFDocument, mark: Mark, options: Options, paint: PaintMark) {
  const page = doc.getPage(mark.page - 1);
  const picture = await paint(mark, options);
  const boxes = boxesOf(page);
  const shown = shownSize(boxes);
  // Inside the page by the same rule as the editor, in case the picture's shape changed
  // after the Mark was placed.
  const inside = keepInside(mark, {
    markAspect: picture.shape,
    pageAspect: shown.width / shown.height,
  });
  const place = placeOnPage(boxes, inside, picture.shape);
  const pixels = pixelsFor(place.width, place.height);
  const image = await doc.embedPng(await picture.paint(pixels.width, pixels.height));
  page.drawImage(image, {
    x: place.x,
    y: place.y,
    width: place.width,
    height: place.height,
    // Turned with the page, so it reads upright as shown.
    rotate: degrees(place.turn),
  });
}

/** The Tool's job, with the painting step passed in so tests can stand in for the canvas. */
export function makeRun(paint: PaintMark): ToolRun<Options> {
  return async (file, options) => {
    const doc = await openToSign(await file.arrayBuffer());
    for (const mark of options.marks) await drawMark(doc, mark, options, paint);
    // Never getForm() (it drops XFA data), and leave filled fields exactly as they were.
    const bytes = await doc.save({ updateFieldAppearances: false, addDefaultPage: false });
    return [
      {
        blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
        detail: 'signed',
      },
    ];
  };
}

export const run = makeRun(paintOnCanvas);
