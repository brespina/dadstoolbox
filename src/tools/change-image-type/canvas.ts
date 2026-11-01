// The browser's own drawing step: open the image, draw it on a canvas and save it.
// Pixel work runs only in a browser; the page tests cover it.

import { drawInSquare, openPicture, type Picture } from '../../photos/picture';
import type { ToolRunContext } from '../types';
import type { Painted } from './run';

/** Most pixels a canvas may hold on an iPhone; bigger ones are tried only where they work. */
const phoneCanvasLimit = 16_777_216;

export async function paintOnCanvas(
  file: File,
  type: string,
  context?: ToolRunContext,
): Promise<Painted> {
  const source = await openPicture(file, context);
  try {
    const full = await draw(source, type, 1);
    if (full) return full;
    // A canvas too big for the device gives nothing back, so try again at a size that fits.
    const scale = Math.sqrt(phoneCanvasLimit / (source.width * source.height));
    const smaller = scale < 1 ? await draw(source, type, scale) : undefined;
    if (smaller) return smaller;
    throw new Error(`Could not draw a ${source.width}×${source.height} image`);
  } finally {
    source.close();
  }
}

async function draw(source: Picture, type: string, scale: number) {
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
 * The image in the middle of a see-through square of each size, never stretched, saved
 * as PNG. The image is opened once and drawn once per size.
 */
export async function paintSquaresOnCanvas(
  file: File,
  sizes: readonly number[],
  context?: ToolRunContext,
): Promise<Painted[]> {
  const source = await openPicture(file, context);
  try {
    const squares: Painted[] = [];
    for (const size of sizes) {
      // The padding and any see-through parts stay see-through.
      const { canvas } = drawInSquare(source, size);
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
