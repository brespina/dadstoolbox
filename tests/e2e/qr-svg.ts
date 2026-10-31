// Shared by the QR code page tests: reads a saved SVG code back to its text the way a
// phone would, with a reader that is not the Site's own (jsQR).
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import type { Download, Page } from '@playwright/test';

/** The saved SVG's text. */
export async function savedText(download: Download) {
  return readFile((await download.path())!, 'utf8');
}

/**
 * Draws the SVG to pixels in the browser, on white paper (a see-through code is meant
 * for a light background), and reads the code in them.
 */
export async function readSvgCode(page: Page, svg: string) {
  const dataUrl = await page.evaluate(async (markup) => {
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      // The size the file states, as a picture of it is shown.
      const side = image.naturalWidth;
      canvas.width = canvas.height = side;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, side, side);
      context.drawImage(image, 0, 0, side, side);
      // As a PNG: far less to carry out of the page than every pixel as a number.
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(url);
    }
  }, svg);
  const png = PNG.sync.read(Buffer.from(dataUrl.split(',')[1]!, 'base64'));
  const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
  return jsQR(rgba, png.width, png.height)?.data;
}
