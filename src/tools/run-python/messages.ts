// The messages between the page and the Python worker, and the checks that let in
// nothing else (ADR-0010: the page treats the Program's side as untrusted, and the worker
// treats the page's the same way). Each side calls its parse function on every message
// and ignores what comes back `undefined`.
//
// To add a message: add its type here,
// give it a case in the matching parse function and a line in messages.test.ts, then
// handle it in python-worker.ts and runner.ts. Nothing else needs to know.

import type { ProgramStream } from './console-buffer';

export type Outcome = 'ok' | 'error' | 'missingModule' | 'stopped';

const outcomes: readonly unknown[] = ['ok', 'error', 'missingModule', 'stopped'];

/** Page to worker. */
export type ToWorker =
  /**
   * Start Python. `base` is the absolute address of the folder holding Pyodide's files.
   * `input` is the memory shared with the page for input() (input-channel.ts); the page
   * leaves it out where the browser can't share memory. `interrupt` is Pyodide's interrupt
   * buffer (interrupt-channel.ts), for Stop; it comes and goes with `input`.
   */
  | { type: 'init'; base: string; input?: SharedArrayBuffer; interrupt?: SharedArrayBuffer }
  /** Run a Program in a fresh namespace. */
  | { type: 'run'; code: string };

/** Worker to page. */
export type FromWorker =
  /** Python has loaded and can run a Program. */
  | { type: 'ready' }
  /** A piece of what the Program printed. */
  | { type: 'out'; stream: ProgramStream; text: string }
  /** The Program has ended. `outcome` is how: well, with an error, or with an error about a missing module, or by Stop (or a Program that raises KeyboardInterrupt). */
  | { type: 'done'; outcome: Outcome }
  /** The Program called input() and waits for a line from the page's `input` memory. */
  | { type: 'input' }
  /** The Program called input() where the browser can't wait for typing. */
  | { type: 'inputUnavailable' }
  /** Python could not start or broke. `message` is the worker's own reason, which the page does not show: it says its own plain words. */
  | { type: 'failed'; message: string };

const isObject = (data: unknown): data is Record<string, unknown> =>
  typeof data === 'object' && data !== null && !Array.isArray(data);

export function parseFromWorker(data: unknown): FromWorker | undefined {
  if (!isObject(data)) return undefined;
  switch (data.type) {
    case 'ready':
      return { type: 'ready' };
    case 'input':
      return { type: 'input' };
    case 'inputUnavailable':
      return { type: 'inputUnavailable' };
    case 'done':
      return outcomes.includes(data.outcome)
        ? { type: 'done', outcome: data.outcome as Outcome }
        : undefined;
    case 'out':
      if ((data.stream !== 'stdout' && data.stream !== 'stderr') || typeof data.text !== 'string')
        return undefined;
      return { type: 'out', stream: data.stream, text: data.text };
    case 'failed':
      return typeof data.message === 'string'
        ? { type: 'failed', message: data.message }
        : undefined;
    default:
      return undefined;
  }
}

export function parseToWorker(data: unknown): ToWorker | undefined {
  if (!isObject(data)) return undefined;
  switch (data.type) {
    case 'init':
      if (typeof data.base !== 'string') return undefined;
      if (typeof SharedArrayBuffer !== 'function') return { type: 'init', base: data.base };
      return {
        type: 'init',
        base: data.base,
        ...(data.input instanceof SharedArrayBuffer && { input: data.input }),
        ...(data.interrupt instanceof SharedArrayBuffer && { interrupt: data.interrupt }),
      };
    case 'run':
      return typeof data.code === 'string' ? { type: 'run', code: data.code } : undefined;
    default:
      return undefined;
  }
}
