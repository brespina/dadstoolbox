// The free code the built Site ships, shown on the credits page.
// credits.test.ts checks this list against package.json and node_modules, so a new
// library can't ship uncredited and a version bump can't leave a stale license.
// To see what a build ships, build with `vite.build.sourcemap` on and list the
// node_modules packages in the maps' `sources`.

export interface Credit {
  /** The library's own name, as its makers write it. */
  name: string;
  /** Its npm package, when it has one. Libraries inside another package have none. */
  package?: string;
  /** The npm package that brings it in, when the Site doesn't use it directly. */
  partOf?: string;
  /** Left out only when the version can't be known, as for libde265. */
  version?: string;
  /** The SPDX license name, as in its package.json. */
  license: string;
  /** What it does for the Site, in plain words. */
  does: string;
  /** Its code, at the version the Site ships. */
  codeUrl: string;
  /** Its license text, at the version the Site ships. */
  licenseUrl: string;
}

// CodeMirror's packages, and the Lezer, style-mod, crelt and find-cluster-break ones that
// go with them, keep their code on their maker's own site and tag each release by number.
const codeMirrorHost = (repo: string, tag: string) => ({
  codeUrl: `https://code.haverbeke.berlin/${repo}/src/tag/${tag}`,
  licenseUrl: `https://code.haverbeke.berlin/${repo}/src/tag/${tag}/LICENSE`,
});

const github = (repo: string, tag: string, file: string) => ({
  codeUrl: `https://github.com/${repo}/tree/${tag}`,
  licenseUrl: `https://github.com/${repo}/blob/${tag}/${file}`,
});

export const credits: Credit[] = [
  {
    name: 'pdf-lib',
    package: 'pdf-lib',
    version: '1.17.1',
    license: 'MIT',
    does: 'Makes and changes PDFs.',
    ...github('Hopding/pdf-lib', 'v1.17.1', 'LICENSE.md'),
  },
  {
    name: 'pako',
    package: 'pako',
    partOf: 'pdf-lib',
    version: '1.0.11',
    license: '(MIT AND Zlib)',
    does: 'Packs and unpacks the data inside a PDF.',
    ...github('nodeca/pako', '1.0.11', 'LICENSE'),
  },
  {
    name: 'standard-fonts',
    package: '@pdf-lib/standard-fonts',
    partOf: 'pdf-lib',
    version: '1.0.0',
    license: 'MIT',
    does: 'The fonts every PDF reader knows.',
    // No release tags, so these point at the main line.
    ...github('Hopding/standard-fonts', 'master', 'LICENSE.md'),
  },
  {
    name: 'UPNG',
    package: '@pdf-lib/upng',
    partOf: 'pdf-lib',
    version: '1.0.1',
    license: 'MIT',
    does: 'Reads PNG pictures inside a PDF.',
    ...github('Hopding/upng', 'master', 'LICENSE'),
  },
  {
    name: 'tslib',
    package: 'tslib',
    partOf: 'pdf-lib',
    version: '1.14.1',
    license: '0BSD',
    does: 'Small helpers its code needs.',
    ...github('microsoft/tslib', 'v1.14.1', 'LICENSE.txt'),
  },
  {
    name: 'PDF.js',
    package: 'pdfjs-dist',
    version: '6.4.299',
    license: 'Apache-2.0',
    does: 'Shows the pages of your PDF, so you can tap where your signature goes.',
    ...github('mozilla/pdf.js', 'v6.4.299', 'LICENSE'),
  },
  // PDF.js's own parts for pictures and letters some PDFs hold, served from the Site and
  // loaded only for a PDF that needs them. None records its own version.
  {
    name: 'OpenJPEG',
    partOf: 'pdfjs-dist',
    license: 'BSD-2-Clause',
    does: 'Shows JPEG 2000 pictures inside a PDF, as in some scanned pages.',
    codeUrl: 'https://github.com/mozilla/pdf.js.openjpeg',
    licenseUrl: 'https://github.com/mozilla/pdf.js.openjpeg/blob/main/LICENSE',
  },
  {
    name: 'pdf.js.jbig2',
    partOf: 'pdfjs-dist',
    // PDF.js's wrapper is Apache-2.0; the PDFium code inside it is BSD-3-Clause.
    license: 'Apache-2.0 AND BSD-3-Clause',
    does: 'Shows black-and-white scanned pages inside a PDF.',
    codeUrl: 'https://github.com/mozilla/pdf.js.jbig2',
    licenseUrl: 'https://github.com/mozilla/pdf.js.jbig2/blob/main/LICENSE',
  },
  {
    name: 'CMap resources',
    partOf: 'pdfjs-dist',
    license: 'BSD-3-Clause',
    does: 'Shows Chinese, Japanese and Korean letters a PDF names but leaves out.',
    codeUrl: 'https://github.com/adobe-type-tools/cmap-resources',
    licenseUrl: 'https://github.com/adobe-type-tools/cmap-resources/blob/master/LICENSE.md',
  },
  {
    name: 'qrcode',
    package: 'qrcode',
    version: '1.5.4',
    license: 'MIT',
    does: 'Makes QR codes.',
    ...github('soldair/node-qrcode', 'v1.5.4', 'license'),
  },
  {
    name: 'dijkstrajs',
    package: 'dijkstrajs',
    partOf: 'qrcode',
    version: '1.0.3',
    license: 'MIT',
    does: 'Finds the smallest QR code that fits your text.',
    ...github('tcort/dijkstrajs', 'v1.0.3', 'LICENSE.md'),
  },
  {
    name: 'heic-to',
    package: 'heic-to',
    version: '1.6.7',
    license: 'LGPL-3.0',
    does: "Opens iPhone photos (HEIC) when your browser can't.",
    ...github('hoppergee/heic-to', 'v1.6.7', 'LICENSE'),
  },
  {
    name: 'libheif',
    partOf: 'heic-to',
    version: '1.23.7',
    license: 'LGPL-3.0',
    does: 'Reads iPhone photos (HEIC).',
    ...github('strukturag/libheif', 'v1.23.7', 'COPYING'),
  },
  {
    name: 'libde265',
    partOf: 'heic-to',
    // No version: heic-to doesn't record which one its build used (its README says
    // 1.0.16, libheif's build script defaults to 1.0.15). heic-to's own code link is
    // the source that matches what ships.
    license: 'LGPL-3.0',
    does: 'Unpacks the picture inside an iPhone photo (HEIC).',
    codeUrl: 'https://github.com/strukturag/libde265',
    licenseUrl: 'https://github.com/strukturag/libde265/blob/master/COPYING',
  },
  {
    name: 'Mediabunny',
    package: 'mediabunny',
    version: '1.61.4',
    license: 'MPL-2.0',
    does: 'Reads your video to make a gif, an MP4, a smaller video or a trimmed clip, or get its sound.',
    ...github('Vanilagy/mediabunny', 'v1.61.4', 'LICENSE'),
  },
  {
    name: 'gifenc',
    package: 'gifenc',
    version: '1.0.3',
    license: 'MIT',
    does: 'Builds the gif from your video.',
    ...github('mattdesl/gifenc', 'v1.0.3', 'LICENSE.md'),
  },
  {
    name: 'Comlink',
    package: 'comlink',
    version: '4.4.2',
    license: 'Apache-2.0',
    does: 'Lets a Tool do heavy work in the background, so the page stays quick.',
    ...github('GoogleChromeLabs/comlink', 'v4.4.2', 'LICENSE'),
  },
  {
    name: 'Pyodide',
    package: 'pyodide',
    version: '314.0.8',
    license: 'MPL-2.0',
    does: 'Runs the Python programs you write on Run Python, on your device.',
    ...github('pyodide/pyodide', '314.0.8', 'LICENSE'),
  },
  {
    name: 'CPython',
    partOf: 'pyodide',
    version: '3.14.2',
    license: 'PSF-2.0',
    does: 'Python itself, which Pyodide brings with it.',
    ...github('python/cpython', 'v3.14.2', 'LICENSE'),
  },
  {
    name: 'CodeMirror state',
    package: '@codemirror/state',
    version: '6.7.6',
    license: 'MIT',
    does: 'Keeps the text of your program and every change you make to it.',
    ...codeMirrorHost('codemirror/state', '6.7.6'),
  },
  {
    name: 'CodeMirror view',
    package: '@codemirror/view',
    version: '6.44.2',
    license: 'MIT',
    does: 'Draws the editor on Run Python and takes your typing.',
    ...codeMirrorHost('codemirror/view', '6.44.2'),
  },
  {
    name: 'CodeMirror commands',
    package: '@codemirror/commands',
    version: '6.11.2',
    license: 'MIT',
    does: 'Gives the editor its keys: undo, redo, indent and moving about.',
    ...codeMirrorHost('codemirror/commands', '6.11.2'),
  },
  {
    name: 'CodeMirror language',
    package: '@codemirror/language',
    version: '6.13.1',
    license: 'MIT',
    does: 'Lets the editor know the shape of code, to colour it and indent it.',
    ...codeMirrorHost('codemirror/language', '6.13.1'),
  },
  {
    name: 'CodeMirror Python',
    package: '@codemirror/lang-python',
    version: '6.2.1',
    license: 'MIT',
    does: 'Teaches the editor Python, so its words are coloured and the next line is indented.',
    ...github('codemirror/lang-python', '6.2.1', 'LICENSE'),
  },
  {
    name: 'CodeMirror autocomplete',
    package: '@codemirror/autocomplete',
    partOf: '@codemirror/lang-python',
    version: '6.20.4',
    license: 'MIT',
    does: 'Comes with CodeMirror Python, which uses parts of it.',
    ...codeMirrorHost('codemirror/autocomplete', '6.20.4'),
  },
  {
    name: 'Lezer highlight',
    package: '@lezer/highlight',
    version: '1.2.5',
    license: 'MIT',
    does: 'Names the kinds of words in code, so each kind can have its own colour.',
    ...codeMirrorHost('lezer/highlight', '1.2.5'),
  },
  {
    name: 'Lezer common',
    package: '@lezer/common',
    partOf: '@codemirror/language',
    version: '1.5.7',
    license: 'MIT',
    does: 'The base the Lezer code readers are built on.',
    ...codeMirrorHost('lezer/common', '1.5.7'),
  },
  {
    name: 'Lezer LR',
    package: '@lezer/lr',
    partOf: '@codemirror/language',
    version: '1.4.13',
    license: 'MIT',
    does: 'Reads code one piece at a time, to tell its words apart.',
    ...codeMirrorHost('lezer/lr', '1.4.13'),
  },
  {
    name: 'Lezer Python',
    package: '@lezer/python',
    partOf: '@codemirror/lang-python',
    version: '1.1.20',
    license: 'MIT',
    does: 'Knows how Python is written, so the editor can colour it.',
    ...codeMirrorHost('lezer/python', '1.1.20'),
  },
  {
    name: 'style-mod',
    package: 'style-mod',
    partOf: '@codemirror/view',
    version: '4.1.5',
    license: 'MIT',
    does: 'Gives the editor its look, in the colours of the Site.',
    ...codeMirrorHost('marijn/style-mod', '4.1.5'),
  },
  {
    name: 'crelt',
    package: 'crelt',
    partOf: '@codemirror/view',
    version: '1.0.7',
    license: 'MIT',
    does: 'Makes the small pieces of the editor.',
    ...codeMirrorHost('marijn/crelt', '1.0.7'),
  },
  {
    name: 'w3c-keyname',
    package: 'w3c-keyname',
    partOf: '@codemirror/view',
    version: '2.2.8',
    license: 'MIT',
    does: 'Tells the editor which key you pressed.',
    ...github('marijnh/w3c-keyname', '2.2.8', 'LICENSE'),
  },
  {
    name: 'find-cluster-break',
    package: '@marijn/find-cluster-break',
    partOf: '@codemirror/state',
    version: '1.0.4',
    license: 'MIT',
    does: 'Finds where one letter ends and the next begins, so the cursor moves one letter at a time.',
    ...codeMirrorHost('marijn/find-cluster-break', '1.0.4'),
  },
  {
    name: 'Svelte',
    package: 'svelte',
    version: '5.57.3',
    license: 'MIT',
    does: 'Makes the buttons and lists on each page respond when you tap.',
    ...github('sveltejs/svelte', 'svelte@5.57.3', 'LICENSE.md'),
  },
  {
    name: 'Astro',
    package: 'astro',
    version: '7.4.4',
    license: 'MIT',
    does: 'Builds each page. A small part of it runs on each page to start the buttons.',
    ...github('withastro/astro', 'astro@7.4.4', 'LICENSE'),
  },
  {
    name: 'Astro Svelte',
    package: '@astrojs/svelte',
    version: '9.1.2',
    license: 'MIT',
    does: 'Starts the Svelte parts of each page.',
    ...github('withastro/astro', '@astrojs/svelte@9.1.2', 'LICENSE'),
  },
  {
    name: 'Vite',
    package: 'vite',
    partOf: 'astro',
    version: '8.3.5',
    license: 'MIT',
    does: "Puts the Site's code together. A small part of it loads each Tool's parts.",
    ...github('vitejs/vite', 'v8.3.5', 'LICENSE'),
  },
];
