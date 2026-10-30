// The browser's own drawing step: open the photo, draw it smaller on a canvas and save
// it as a JPG. Pixel work runs only in a browser; the page tests cover it.
// Shared by Make a photo smaller and Photos to one PDF.

import type { ToolRunContext } from '../tools/types';
import { openPhoto } from './open';

/** How small to make a photo: its longest side in pixels and the JPG quality (0 to 1). */
export interface How {
  longestSide: number;
  quality: number;
}
/** A photo drawn the right way up, no bigger than `how` says, saved as a JPG with no details. */
export type Shrink = (file: File, how: How, context?: ToolRunContext) => Promise<Blob>;

/** The {@link Shrink} step on a real canvas. A photo already small enough keeps its size. */
export const shrinkOnCanvas: Shrink = async (file, how, context) => {
  // Opening turns the photo the right way up by itself, so its width and height are as seen.
  // Where the browser can't open an iPhone photo (HEIC), the shared fallback does.
  const bitmap = await openPhoto(file, context);
  try {
    const scale = Math.min(1, how.longestSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    // Halving step by step looks sharper than one big jump down.
    let from: CanvasImageSource = bitmap;
    let fromWidth = bitmap.width;
    let fromHeight = bitmap.height;
    let step: HTMLCanvasElement | undefined;
    while (fromWidth / 2 >= width && fromHeight / 2 >= height) {
      const half = draw(from, Math.round(fromWidth / 2), Math.round(fromHeight / 2));
      free(step);
      step = half;
      from = half;
      fromWidth = half.width;
      fromHeight = half.height;
    }
    const canvas = draw(from, width, height);
    free(step);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', how.quality),
    );
    free(canvas);
    if (!blob || blob.size === 0) throw new Error(`Could not draw a ${width}×${height} photo`);
    return blob;
  } finally {
    bitmap.close();
  }
};

function draw(from: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error(`Could not draw a ${width}×${height} photo`);
  // JPG can't be see-through, so see-through parts become white, not black.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(from, 0, 0, width, height);
  return canvas;
}

/** Frees a canvas's memory now; phones have little to spare. */
function free(canvas: HTMLCanvasElement | undefined) {
  if (canvas) canvas.width = canvas.height = 0;
}
