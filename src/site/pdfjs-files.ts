// Serves the data files pdf.js asks for by name from the Site, at fixed addresses under
// pdfjs/<version>/ (ADR-0006). They have no import graph (pdf.js builds each address from
// a folder and a file name), so the build copies them and the dev server serves them.
// Sign a PDF's viewer (src/tools/sign-pdf/viewer.ts) points pdf.js at the same folder.
//
// - cmaps/: for Chinese, Japanese and Korean letters a PDF names but leaves out.
// - wasm/*_nowasm_fallback.js: pdf.js's plain-script decoders for JPEG 2000 and JBIG2
//   pictures (some scanned pages), used because the Site runs no WebAssembly.
// The standard fonts are left out: pdf.js then uses the device's own fonts for the few
// fonts a PDF may name without holding them.

import { readFileSync } from 'node:fs';
import { cp, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const pdfjs = fileURLToPath(new URL('../../node_modules/pdfjs-dist/', import.meta.url));
const { version } = JSON.parse(readFileSync(join(pdfjs, 'package.json'), 'utf8')) as {
  version: string;
};

/** Each served file or folder, by its path under pdfjs/<version>/. */
const served = [
  'cmaps',
  'wasm/jbig2_nowasm_fallback.js',
  'wasm/openjpeg_nowasm_fallback.js',
] as const;

const types: Record<string, string> = {
  '.js': 'text/javascript',
  '.bcmap': 'application/octet-stream',
};

export function pdfjsFiles(): AstroIntegration {
  let base = '/';
  return {
    name: 'dadstoolbox:pdfjs-files',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = `/${config.base}/`.replace(/\/+/g, '/');
      },
      'astro:server:setup': ({ server }) => {
        const prefix = `${base}pdfjs/${version}/`;
        server.middlewares.use((request, response, next) => {
          const path = request.url?.split('?')[0];
          if (!path?.startsWith(prefix)) return next();
          const wanted = normalize(decodeURIComponent(path.slice(prefix.length))).replace(
            /\\/g,
            '/',
          );
          if (!served.some((item) => wanted === item || wanted.startsWith(`${item}/`)))
            return next();
          readFile(join(pdfjs, wanted)).then(
            (bytes) => {
              response.setHeader('Content-Type', types[extname(wanted)] ?? 'text/plain');
              response.end(bytes);
            },
            () => next(),
          );
        });
      },
      'astro:build:done': async ({ dir }) => {
        const out = join(fileURLToPath(dir), 'pdfjs', version);
        for (const item of served) {
          await cp(join(pdfjs, item), join(out, item), { recursive: true });
        }
      },
    },
  };
}
