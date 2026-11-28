// The Python worker. The page builds it as a worker made from a `blob:` URL
// (`?worker&inline`, see Practice.svelte), because only a blob worker inherits the page's
// browser lock, so a Program cannot send anything beyond the Site (ADR-0010). Any Tool
// that runs a visitor's own program must do the same.
//
// It is one self-contained file: it imports only `messages.ts` and `input-channel.ts` (and types), and loads
// Pyodide by the absolute address the page sends in `init`. A blob worker has no address
// of its own to resolve a relative one against. It loads no package (ADR-0008).
//
// Seams: each message the page sends has a case in `onMessage`; `runProgram` is the one
// place a Program runs, and helper.py is the Python it calls (tracebacks, #126).
// input() waits in `createStdin` (input-channel.ts), set up in `start`.

import type { PyodideAPI } from 'pyodide';
import { createStdin } from './input-channel';
import { parseToWorker, type FromWorker, type Outcome } from './messages';
import helper from './helper.py?raw';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: FromWorker): void;
};

let pyodide: PyodideAPI | undefined;
/** `run_program` from helper.py: runs a Program and returns how it ended. */
let runInPython: ((code: string) => Outcome) | undefined;
let running = false;

/** Turns a stream's bytes into text, keeping a letter split across two pieces whole. */
function streamTo(stream: 'stdout' | 'stderr') {
  const decoder = new TextDecoder();
  return {
    write(bytes: Uint8Array) {
      const text = decoder.decode(bytes, { stream: true });
      if (text) scope.postMessage({ type: 'out', stream, text });
      // Tell Pyodide all of it was taken.
      return bytes.length;
    },
    /** Sends what the decoder still holds, at the end of a Program. */
    flush() {
      const text = decoder.decode();
      if (text) scope.postMessage({ type: 'out', stream, text });
    },
  };
}

const stdout = streamTo('stdout');
const stderr = streamTo('stderr');

async function start(base: string, input: SharedArrayBuffer | undefined) {
  const { loadPyodide } = (await import(/* @vite-ignore */ `${base}pyodide.mjs`)) as {
    loadPyodide: typeof import('pyodide').loadPyodide;
  };
  pyodide = await loadPyodide({
    indexURL: base,
    lockFileURL: `${base}pyodide-lock.json`,
    fullStdLib: false,
  });
  pyodide.setStdout({ write: (bytes: Uint8Array) => stdout.write(bytes) });
  pyodide.setStderr({ write: (bytes: Uint8Array) => stderr.write(bytes) });
  // input() waits for the page to send a line, or ends with EOFError where it can't.
  pyodide.setStdin({
    stdin: createStdin(input, {
      waiting: () => scope.postMessage({ type: 'input' }),
      unavailable: () => scope.postMessage({ type: 'inputUnavailable' }),
    }),
  });
  const namespace = pyodide.globals.get('dict')();
  pyodide.runPython(helper, { globals: namespace });
  runInPython = namespace.get('run_program');
  namespace.destroy();
  scope.postMessage({ type: 'ready' });
}

/** Runs a Program with the helper, which gives it a fresh namespace and prints any error. */
function runProgram(run: (code: string) => Outcome, code: string): Outcome {
  try {
    return run(code);
  } catch (error) {
    // The helper catches whatever a Program does, so this is Python itself breaking.
    stderr.write(new TextEncoder().encode(`${(error as Error).message}\n`));
    return 'error';
  } finally {
    stdout.flush();
    stderr.flush();
  }
}

scope.onmessage = (event) => {
  const message = parseToWorker(event.data);
  if (!message) return;
  switch (message.type) {
    case 'init':
      if (!pyodide) {
        start(message.base, message.input).catch((error: unknown) =>
          scope.postMessage({ type: 'failed', message: String(error) }),
        );
      }
      return;
    case 'run':
      if (!runInPython || running) return;
      running = true;
      try {
        scope.postMessage({ type: 'done', outcome: runProgram(runInPython, message.code) });
      } finally {
        running = false;
      }
      return;
  }
};
