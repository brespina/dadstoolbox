// The Tool's job: draw each Mark's picture on its page and save the PDF again. pdf.js is
// never imported here: it loads only inside the page editor (ADR-0006).

import type { PDFDocument, PDFPage } from 'pdf-lib';
import type { ToolRun } from '../types';
import { openToSign } from './can-sign';
import type { Mark, Options } from './declaration';
import { paintOnCanvas, type PaintMark } from './paint';

/** Marks are painted at this many dots an inch of their size on the page (ADR-0007)… */
const dotsPerInch = 300;
/** …with no side longer than this, in pixels. */
const longestSide = 2000;
/** PDF points in an inch. */
const pointsPerInch = 72;

/**
 * Where a Mark's picture goes on its page, in PDF points: its lower-left corner and its
 * size. The height follows from the picture's shape (width ÷ height); none is stored.
 * Pages here are unturned and uncropped; #110 adds turned and cropped pages.
 */
function placeOn(page: PDFPage, mark: Mark, shape: number) {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const width = mark.width * pageWidth;
  const height = width / shape;
  // A Mark's y counts down from the top, and PDF points count up from the bottom.
  return { x: mark.x * pageWidth, y: pageHeight - mark.y * pageHeight - height, width, height };
}

/** The picture's size in pixels for a place on the page `width` × `height` points. */
function pixelsFor(width: number, height: number) {
  const scale = Math.min(dotsPerInch / pointsPerInch, longestSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function drawMark(doc: PDFDocument, mark: Mark, options: Options, paint: PaintMark) {
  const page = doc.getPage(mark.page - 1);
  const picture = await paint(mark, options);
  const place = placeOn(page, mark, picture.shape);
  const pixels = pixelsFor(place.width, place.height);
  const image = await doc.embedPng(await picture.paint(pixels.width, pixels.height));
  page.drawImage(image, place);
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
