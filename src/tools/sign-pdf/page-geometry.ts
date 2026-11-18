// Where a Mark's picture goes in a PDF's own coordinates (ADR-0007). Pure: numbers in,
// numbers out, so every turn and an offset visible box are tested with exact figures.
// Only `run` uses it.
//
// It follows what pdf.js shows in the editor, so a Mark lands where it was placed: the page
// as shown is the CropBox inside the MediaBox, turned by /Rotate.

import type { Mark } from './declaration';

/** A box as PDF writes it: two opposite corners, `[x, y, x, y]`, in either order. */
export type Box = readonly number[];

/** What a page says about its own shape, as read from the PDF (all may be missing). */
export interface PageBoxes {
  mediaBox?: Box;
  cropBox?: Box;
  /** The page's /Rotate, whatever it holds. */
  rotate?: number;
}

/** A page's visible box with its corners in order: `[left, bottom, right, top]`. */
type Corners = [number, number, number, number];

/** What pdf.js uses for a page with no usable MediaBox. */
const letter: Corners = [0, 0, 612, 792];

/** The box with its corners in order, or nothing if it isn't four numbers around some area. */
function inOrder(box: Box | undefined): Corners | undefined {
  if (!box || box.length !== 4 || !box.every(Number.isFinite)) return undefined;
  const [a, b, c, d] = box as [number, number, number, number];
  const corners: Corners = [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
  return corners[2] > corners[0] && corners[3] > corners[1] ? corners : undefined;
}

/**
 * The part of the page that shows: the CropBox inside the MediaBox, as pdf.js works it out.
 * Falls back to the MediaBox for a CropBox with nothing on it, and to Letter for a page
 * with no usable MediaBox.
 */
export function visibleBox(mediaBox: Box | undefined, cropBox: Box | undefined): Corners {
  const media = inOrder(mediaBox) ?? letter;
  const crop = inOrder(cropBox);
  if (!crop) return media;
  const inside: Corners = [
    Math.max(media[0], crop[0]),
    Math.max(media[1], crop[1]),
    Math.min(media[2], crop[2]),
    Math.min(media[3], crop[3]),
  ];
  // Nothing in common is not a box: the MediaBox shows.
  return inside[2] > inside[0] && inside[3] > inside[1] ? inside : media;
}

/** How far the page is turned clockwise as shown, in whole quarter turns, from 0 to 270. */
export function turnOf(rotate: number | undefined): 0 | 90 | 180 | 270 {
  if (rotate === undefined || !Number.isFinite(rotate) || rotate % 90 !== 0) return 0;
  return (((rotate % 360) + 360) % 360) as 0 | 90 | 180 | 270;
}

/** The page as shown, in PDF points: the visible box, with its sides swapped when turned a quarter. */
export function shownSize(page: PageBoxes) {
  const [left, bottom, right, top] = visibleBox(page.mediaBox, page.cropBox);
  const wide = right - left;
  const high = top - bottom;
  return turnOf(page.rotate) % 180 === 0
    ? { width: wide, height: high }
    : { width: high, height: wide };
}

/** A picture's place in the PDF: its lower-left corner, its size, and its turn. */
export interface PlacedPicture {
  /** The picture's lower-left corner, in the PDF's own points. */
  x: number;
  y: number;
  /** The picture's own width and height, in points (before its turn). */
  width: number;
  height: number;
  /** How far to turn the picture anticlockwise about that corner, in degrees. */
  turn: 0 | 90 | 180 | 270;
}

/**
 * Where a Mark's picture goes. `shape` is the picture's width ÷ height; the height always
 * follows from it, and none is stored on the Mark.
 */
export function placeOnPage(
  page: PageBoxes,
  mark: Pick<Mark, 'x' | 'y' | 'width'>,
  shape: number,
): PlacedPicture {
  const [left, bottom, right, top] = visibleBox(page.mediaBox, page.cropBox);
  const turn = turnOf(page.rotate);
  const shown = shownSize(page);
  const width = mark.width * shown.width;
  const height = width / shape;
  // The picture's lower-left corner on the page as shown, counted from its top-left corner.
  const across = mark.x * shown.width;
  const down = mark.y * shown.height + height;
  // Which way across and down run in the PDF depends on the turn: a page turned 90 starts
  // from the visible box's lower-left corner, and across runs up it.
  const corner = {
    0: { x: left + across, y: top - down },
    90: { x: left + down, y: bottom + across },
    180: { x: right - across, y: bottom + down },
    270: { x: right - down, y: top - across },
  }[turn];
  return { ...corner, width, height, turn };
}
