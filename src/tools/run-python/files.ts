// Run Python's files. Plain data and pure functions, so the page, plain Node and Vitest
// can all read it without loading Pyodide.
import { tool } from './declaration';

// Where Python's files are served from. src/site/pyodide-files.ts puts them there at
// build time; files.test.ts checks `pyodideVersion` is the installed one.
export const pyodideVersion = '314.0.8';

/** The folder, relative to the Site: "run-python/pyodide/314.0.8". */
export const pyodideFolder = `run-python/pyodide/${pyodideVersion}`;

// The Program's own file: choosing a .py file in, saving one out (#131). The page does
// the picking and saving (RunPython.svelte, src/site/save.ts); this decides what a
// chosen file means and what the saved one is called.

/** The biggest file Choose takes (500 KB). A Program is text a person wrote. */
export const maxProgramBytes = 500_000;

/** The name of the saved file when none was chosen. */
const noName = 'my-program';
const longest = 100;

/** True when a file of this size is too big, so it can be refused without being read. */
export function tooBigToRead(size: number): boolean {
  return size > maxProgramBytes;
}

export type ReadProgram = { ok: true; text: string } | { ok: false; reason: string };

/**
 * The chosen file's bytes as the Program's text: strict UTF-8, no NUL bytes, no bigger
 * than the cap. Anything else gets a plain reason, and the Program stays as it was.
 */
export function readProgram(bytes: Uint8Array): ReadProgram {
  if (tooBigToRead(bytes.length)) return { ok: false, reason: tool.notes.tooBig };
  if (bytes.includes(0)) return { ok: false, reason: tool.notes.notAProgram };
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, reason: tool.notes.notAProgram };
  }
}

// Names a Windows device refuses whatever the extension.
const deviceNames = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * The saved file's name: the chosen file's name, without its folders or characters a
 * device may refuse, always ending `.py`; `my-program.py` when none was chosen.
 */
export function programFileName(chosen: string | undefined): string {
  const last = (chosen ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = last
    // eslint-disable-next-line no-control-regex -- control characters are what is removed
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\.(py|txt|text)\s*$/i, '')
    // A device may refuse a name that ends in a dot or space.
    .replace(/^[\s.]+|[\s.]+$/g, '');
  if (cleaned === '') return `${noName}.py`;
  const safe = deviceNames.test(cleaned) ? `_${cleaned}` : cleaned;
  return `${safe.slice(0, longest - '.py'.length).trimEnd()}.py`;
}
