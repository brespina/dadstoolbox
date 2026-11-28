// The typed Signature's font, Dancing Script (OFL-1.1), served from the Site. Its file
// has an address through `?url` but nothing fetches it until `loadSignatureFont` runs, so
// only a person who chooses "Type it instead" ever loads it. Never import the package's
// CSS: its @font-face would fetch the file as soon as any text used the family.

import latin from '@fontsource/dancing-script/files/dancing-script-latin-400-normal.woff2?url';
import { signatureFont } from './declaration';

let loading: Promise<void> | undefined;

/**
 * Loads the font once and adds it to the page, so canvases and CSS can use it. Painting
 * and measuring wait for this: a canvas given a font that is not there yet quietly uses
 * the device's own. If the file can't load, the device's own font is used instead, for
 * the editor and for the saved PDF alike.
 */
export function loadSignatureFont(): Promise<void> {
  loading ??= (async () => {
    try {
      const face = new FontFace(signatureFont, `url(${latin})`, { weight: '400' });
      await face.load();
      document.fonts.add(face);
    } catch (error) {
      console.error('Could not load the signature font', error);
      // Try again next time it is wanted.
      loading = undefined;
    }
  })();
  return loading;
}
