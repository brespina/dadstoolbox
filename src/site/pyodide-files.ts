// Serves Python's files (ADR-0008) from the Site, at fixed addresses under
// run-python/pyodide/<version>/. The Python worker imports `pyodide.mjs` from there by
// absolute address and Pyodide then fetches the rest by name, so (as with pdfjs-files.ts)
// the build copies the files and the dev server serves them. They are not committed and
// never modified. Run Python's worker (src/tools/run-python/python-worker.ts) points at the
// same folder, through `pyodideFolder` in src/tools/run-python/files.ts.

import { readFileSync } from 'node:fs';
import { cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const pyodide = fileURLToPath(new URL('../../node_modules/pyodide/', import.meta.url));
const { version } = JSON.parse(readFileSync(join(pyodide, 'package.json'), 'utf8')) as {
  version: string;
};

/** Each served file, with the type the browser needs to accept it. */
const served = {
  'pyodide.asm.wasm': 'application/wasm',
  'pyodide.asm.mjs': 'text/javascript',
  'pyodide.mjs': 'text/javascript',
  'python_stdlib.zip': 'application/zip',
  'pyodide-lock.json': 'application/json',
} as const;

export function pyodideFiles(): AstroIntegration {
  let base = '/';
  return {
    name: 'dadstoolbox:pyodide-files',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = `/${config.base}/`.replace(/\/+/g, '/');
      },
      'astro:server:setup': ({ server }) => {
        const prefix = `${base}run-python/pyodide/${version}/`;
        server.middlewares.use((request, response, next) => {
          const path = request.url?.split('?')[0];
          if (!path?.startsWith(prefix)) return next();
          // Only the five names: nothing else in the folder, and no way out of it.
          const name = decodeURIComponent(path.slice(prefix.length));
          if (!Object.hasOwn(served, name)) return next();
          readFile(join(pyodide, name)).then(
            (bytes) => {
              response.setHeader('Content-Type', served[name as keyof typeof served]);
              response.end(bytes);
            },
            () => next(),
          );
        });
      },
      'astro:build:done': async ({ dir }) => {
        const out = join(fileURLToPath(dir), 'run-python', 'pyodide', version);
        for (const name of Object.keys(served)) {
          await cp(join(pyodide, name), join(out, name));
        }
      },
    },
  };
}
