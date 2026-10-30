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
    does: 'Reads your video when you make a gif from it.',
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
