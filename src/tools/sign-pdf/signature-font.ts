// The typed Signature's font, Dancing Script (OFL-1.1), served from the Site. Its files
// have addresses through `?url` but nothing fetches them until `loadSignatureFont` runs, so
// only a person who chooses "Type it instead" ever loads them. Never import the package's
// CSS: its @font-face would fetch the files as soon as any text used the family.

import latinExt from '@fontsource/dancing-script/files/dancing-script-latin-ext-400-normal.woff2?url';
import latin from '@fontsource/dancing-script/files/dancing-script-latin-400-normal.woff2?url';
import vietnamese from '@fontsource/dancing-script/files/dancing-script-vietnamese-400-normal.woff2?url';
import { signatureFont } from './declaration';

/**
 * Every letter the font has, in the package's three files, each with the letters it
 * holds (as the package's own CSS lists them), so a name like "Łukasz" or "Nguyễn" is
 * all in the one font.
 */
const files = [
  {
    url: latin,
    letters:
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  },
  {
    url: latinExt,
    letters:
      'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  },
  {
    url: vietnamese,
    letters:
      'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
  },
];

let loading: Promise<void> | undefined;

/** Loads every file of the font and adds it to the page, so canvases and CSS can use it. */
async function load() {
  const faces = files.map(
    ({ url, letters }) =>
      new FontFace(signatureFont, `url(${url})`, { weight: '400', unicodeRange: letters }),
  );
  // Each is loaded now: a canvas doesn't wait for a font file the page fetches later.
  await Promise.all(faces.map((face) => face.load()));
  for (const face of faces) document.fonts.add(face);
}

/**
 * Loads the font once. Painting and measuring wait for this: a canvas given a font that
 * is not there yet quietly uses the device's own. If the files can't load, the device's
 * own font is used instead, for the editor and for the saved PDF alike.
 */
export function loadSignatureFont(): Promise<void> {
  loading ??= load().catch((error: unknown) => {
    console.error('Could not load the signature font', error);
    // Try again next time it is wanted.
    loading = undefined;
  });
  return loading;
}
