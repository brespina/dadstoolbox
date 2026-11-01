// Opening a picture for drawing on a canvas, in a browser: a photo through `openPhoto`,
// an SVG through an image element. Shared by Change image file type and the QR codes'
// logo. Pixel work runs only in a browser; the page tests cover it.

import { fileTypeOf } from '../tools/file-type';
import type { ToolRunContext } from '../tools/types';
import { openPhoto } from './open';
import { sizeSvg } from './svg';

/** A picture opened for drawing, at the size it is drawn at before any shrinking. */
export interface Picture {
  image: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

/**
 * An SVG has no pixels of its own and `createImageBitmap` can't open one reliably, so it
 * goes through an image element, at the size `sizeSvg` works out.
 */
async function openSvg(file: File): Promise<Picture> {
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

/** Opens a picture for drawing. Throws for a file that is not a picture the browser can open. */
export async function openPicture(file: File, context?: ToolRunContext): Promise<Picture> {
  if (fileTypeOf(file) === 'image/svg+xml') return openSvg(file);
  // Opening turns the photo the right way up by itself.
  const bitmap = await openPhoto(file, context);
  return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
}

/**
 * Where an image goes on a see-through square so it fits whole, in the middle, never
 * stretched. Rounded to whole pixels; the square is `size` wide and tall.
 */
export function fitInSquare(width: number, height: number, size: number) {
  const scale = size / Math.max(width, height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  return { x: Math.round((size - w) / 2), y: Math.round((size - h) / 2), width: w, height: h };
}
