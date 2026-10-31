// The browser's own drawing step: open the photo, draw it on a canvas and save it.
// Pixel work runs only in a browser; the page tests cover it.

import { openPhoto } from '../../photos/open';
import { sizeSvg } from '../../photos/svg';
import { fileTypeOf } from '../file-type';
import type { ToolRunContext } from '../types';
import { fitInSquare } from './ico';
import type { Painted } from './run';

/** Most pixels a canvas may hold on an iPhone; bigger ones are tried only where they work. */
const phoneCanvasLimit = 16_777_216;

/** A picture opened for drawing, at the size it is drawn at before any shrinking. */
interface Source {
  image: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

/**
 * An SVG has no pixels of its own and `createImageBitmap` can't open one reliably, so it
 * goes through an image element, at the size `sizeSvg` works out.
 */
async function openSvg(file: File): Promise<Source> {
  const { markup, width, height } = sizeSvg(await file.text());
  // The file's own type may be empty, and the browser needs this one to read it as an SVG.
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  const close = () => URL.revokeObjectURL(url);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The browser could not open this SVG'));
      image.src = url;
    });
  } catch (error) {
    close();
    throw error;
  }
  return { image, width, height, close };
}

async function openSource(file: File, context?: ToolRunContext): Promise<Source> {
  if (fileTypeOf(file) === 'image/svg+xml') return openSvg(file);
  // Opening turns the photo the right way up by itself.
  const bitmap = await openPhoto(file, context);
  return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
}

export async function paintOnCanvas(
  file: File,
  type: string,
  context?: ToolRunContext,
): Promise<Painted> {
  const source = await openSource(file, context);
  try {
    const full = await draw(source, type, 1);
    if (full) return full;
    // A canvas too big for the device gives nothing back, so try again at a size that fits.
    const scale = Math.sqrt(phoneCanvasLimit / (source.width * source.height));
    const smaller = scale < 1 ? await draw(source, type, scale) : undefined;
    if (smaller) return smaller;
    throw new Error(`Could not draw a ${source.width}×${source.height} photo`);
  } finally {
    source.close();
  }
}

async function draw(source: Source, type: string, scale: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(source.width * scale));
  canvas.height = Math.max(1, Math.floor(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  // JPG can't be see-through, so see-through parts become white, not black.
  if (type === 'image/jpeg') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  const { width, height } = canvas;
  // Free the canvas's memory now; phones have little to spare.
  canvas.width = canvas.height = 0;
  return blob && blob.size > 0 ? { blob, width, height } : undefined;
}

/**
 * The photo in the middle of a see-through square of each size, never stretched, saved
 * as PNG. The photo is opened once and drawn once per size.
 */
export async function paintSquaresOnCanvas(
  file: File,
  sizes: readonly number[],
  context?: ToolRunContext,
): Promise<Painted[]> {
  const source = await openSource(file, context);
  try {
    const squares: Painted[] = [];
    for (const size of sizes) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const drawing = canvas.getContext('2d');
      if (!drawing) throw new Error('Could not draw an icon');
      // The canvas starts see-through, so the padding and any see-through parts stay so.
      drawing.imageSmoothingQuality = 'high';
      const fit = fitInSquare(source.width, source.height, size);
      drawing.drawImage(source.image, fit.x, fit.y, fit.width, fit.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      canvas.width = canvas.height = 0;
      if (!blob || blob.size === 0) throw new Error(`Could not draw a ${size} px icon`);
      squares.push({ blob, width: size, height: size });
    }
    return squares;
  } finally {
    source.close();
  }
}
