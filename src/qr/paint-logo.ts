// The browser's own drawing of a logo: open it and draw it on a canvas, for its pixels.
// Pixel work runs only in a browser; the QR drawing's tests use a stand-in, and the page
// tests cover this.

import { drawInSquare, openPicture } from '../photos/picture';

/**
 * The logo's pixels on a see-through square `side` wide: fitted whole, in the middle,
 * never stretched. Red, green, blue and alpha for each pixel, row by row. Throws for a
 * file that is not a picture the browser can open.
 */
export async function paintLogoOnCanvas(logo: File, side: number): Promise<Uint8ClampedArray> {
  const picture = await openPicture(logo);
  try {
    const { canvas, drawing } = drawInSquare(picture, side);
    const { data } = drawing.getImageData(0, 0, side, side);
    // Free the canvas's memory now; phones have little to spare.
    canvas.width = canvas.height = 0;
    return data;
  } finally {
    picture.close();
  }
}
