// The browser's own drawing step: open the photo, draw it on a canvas and save it.
// Pixel work runs only in a browser; the page tests cover it.

import type { Painted } from './run';

/** Most pixels a canvas may hold on an iPhone; bigger ones are tried only where they work. */
const phoneCanvasLimit = 16_777_216;

export async function paintOnCanvas(file: File, type: string): Promise<Painted> {
  // Opening turns the photo the right way up by itself.
  const bitmap = await createImageBitmap(file);
  try {
    const full = await draw(bitmap, type, 1);
    if (full) return full;
    // A canvas too big for the device gives nothing back, so try again at a size that fits.
    const scale = Math.sqrt(phoneCanvasLimit / (bitmap.width * bitmap.height));
    const smaller = scale < 1 ? await draw(bitmap, type, scale) : undefined;
    if (smaller) return smaller;
    throw new Error(`Could not draw a ${bitmap.width}×${bitmap.height} photo`);
  } finally {
    bitmap.close();
  }
}

async function draw(bitmap: ImageBitmap, type: string, scale: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
  canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  // JPG can't be see-through, so see-through parts become white, not black.
  if (type === 'image/jpeg') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  const { width, height } = canvas;
  // Free the canvas's memory now; phones have little to spare.
  canvas.width = canvas.height = 0;
  return blob && blob.size > 0 ? { blob, width, height } : undefined;
}
