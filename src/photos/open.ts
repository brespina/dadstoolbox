// Opening a photo for drawing, in a browser. The browser's own decoder goes first. Where
// it can't open an iPhone photo (HEIC), as in Chrome, heic-to (libheif) does, loaded
// only then. It is big, so it never loads with the page.

import type { ToolRunContext } from '../tools/types';
import { isHeif } from './exif';

type Decoder = typeof import('heic-to/csp');

let decoder: Promise<Decoder> | undefined;
// The CSP build has no eval, so it works under the browser lock. It decodes in its own
// worker, so the page stays responsive.
const loadDecoder = () =>
  (decoder ??= import('heic-to/csp').catch((error: unknown) => {
    // Forget a failed load, so the next photo tries again.
    decoder = undefined;
    throw error;
  }));

/**
 * Opens a photo the right way up. Throws the browser's own error for a file that is not
 * a photo it can open, and heic-to's for an iPhone photo (HEIC) neither can open.
 */
export async function openPhoto(file: Blob, context?: ToolRunContext): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch (error) {
    if (!isHeif(new Uint8Array(await file.slice(0, 12).arrayBuffer()))) throw error;
  }
  const { heicTo } = await (context?.gettingReady(loadDecoder()) ?? loadDecoder());
  return heicTo({ blob: file, type: 'bitmap' });
}
