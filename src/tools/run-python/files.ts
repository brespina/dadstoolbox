// Where Python's files are served from. src/site/pyodide-files.ts puts them there at
// build time; files.test.ts checks `pyodideVersion` is the installed one. Plain data, so
// the page (and plain Node) can read it without loading Pyodide.

export const pyodideVersion = '314.0.8';

/** The folder, relative to the Site: "run-python/pyodide/314.0.8". */
export const pyodideFolder = `run-python/pyodide/${pyodideVersion}`;
