// The page's side of a Run: it starts the Python worker, tracks whether Python is
// getting ready, ready, running or failed, sends a Program and passes what comes back to
// the Console. It takes the worker as an argument (`makeWorker`), so Vitest passes a
// fake; Practice.svelte passes the real blob worker.
//
// Seams for the tickets after this one (#126 to #129): add the message in messages.ts, send it from a new method here,
// and turn what comes back in `onMessage` into a state change or a Console call.

import type { Stream } from './console-buffer';
import { createInputBuffer, sendLine } from './input-channel';
import { parseFromWorker, type ToWorker } from './messages';

/** What the runner needs from a Worker, so a test can pass a stand-in. */
export interface WorkerLike {
  postMessage(message: ToWorker): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessageerror: ((event: unknown) => void) | null;
}

export type RunnerState =
  | { name: 'gettingReady' }
  | { name: 'ready' }
  | { name: 'running' }
  | { name: 'failed'; reason: string };

/** Where a Run's output goes. The page batches writes; the runner only calls them. */
export interface ConsoleSink {
  clear(): void;
  write(text: string, stream: Stream): void;
}

export interface RunnerOptions {
  makeWorker: () => WorkerLike;
  /** The absolute address of the folder holding Pyodide's files, ending in a slash. */
  base: string;
  /** The plain reasons the page shows when Python is not running. */
  reasons: { didNotStart: string; stopped: string; tookTooLong: string };
  /**
   * The page's own words: at the end of a Run (after a good one, and after a missing
   * module), and when input() can't wait for typing here.
   */
  words: { done: string; missingModule: string; noInput: string };
  /** Whether the page is cross-origin isolated, so the Program can wait for typing (ADR-0009). */
  isolated?: boolean;
  onState: (state: RunnerState) => void;
  /** Whether a Program waits for a typed line: the page shows its typing field while true. */
  onInput: (waiting: boolean) => void;
  console: ConsoleSink;
}

export interface Runner {
  /** Starts Python. Call once, when the page opens. */
  start(): void;
  /** Clears the Console and runs a Program. Does nothing unless Python is ready. */
  run(code: string): void;
  /** Sends the typed line to the waiting Program, and shows it in the Console as a line. */
  answer(line: string): void;
  /** After a failure: starts Python again with a new worker. */
  retry(): void;
  /** Ends the worker, when the page goes away. */
  dispose(): void;
  state(): RunnerState;
}

/** Pyodide waits for ever when its files are blocked, so the runner gives up after this. */
export const readyTimeoutMs = 3 * 60 * 1000;

export function createRunner(options: RunnerOptions): Runner {
  let state: RunnerState = { name: 'gettingReady' };
  let worker: WorkerLike | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The memory shared with the worker for input(); absent where the page is not isolated.
  let inputBuffer: SharedArrayBuffer | undefined;
  let waiting = false;

  function setState(next: RunnerState) {
    state = next;
    options.onState(next);
  }

  function setWaiting(next: boolean) {
    if (waiting === next) return;
    waiting = next;
    options.onInput(next);
  }

  function stopWorker() {
    setWaiting(false);
    clearTimeout(timer);
    timer = undefined;
    if (worker) {
      // A stopped worker may still have messages on the way: let none of them in.
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      worker.terminate();
      worker = undefined;
    }
  }

  function fail(reason: string) {
    stopWorker();
    setState({ name: 'failed', reason });
  }

  /** The reason for an end the runner did not ask for, by when it happened. */
  const unexpectedEnd = () =>
    fail(state.name === 'gettingReady' ? options.reasons.didNotStart : options.reasons.stopped);

  function onMessage(data: unknown) {
    const message = parseFromWorker(data);
    if (!message) return;
    switch (message.type) {
      case 'ready':
        if (state.name !== 'gettingReady') return;
        clearTimeout(timer);
        setState({ name: 'ready' });
        return;
      case 'out':
        if (state.name === 'running') options.console.write(message.text, message.stream);
        return;
      case 'input':
        // Only a Program that is running, on a page that gave it somewhere to wait.
        if (state.name === 'running' && inputBuffer) setWaiting(true);
        return;
      case 'inputUnavailable':
        if (state.name === 'running') options.console.write(`${options.words.noInput}\n`, 'note');
        return;
      case 'done':
        if (state.name !== 'running') return;
        setWaiting(false);
        // The page's words go to the Console as `note`, apart from the Program's output.
        if (message.outcome === 'ok') options.console.write(`${options.words.done}\n`, 'note');
        else if (message.outcome === 'missingModule')
          options.console.write(`${options.words.missingModule}\n`, 'note');
        setState({ name: 'ready' });
        return;
      case 'failed':
        unexpectedEnd();
        return;
    }
  }

  function begin() {
    setState({ name: 'gettingReady' });
    let created: WorkerLike;
    try {
      created = options.makeWorker();
    } catch {
      // The browser refused to start the worker at all.
      fail(options.reasons.didNotStart);
      return;
    }
    worker = created;
    created.onmessage = (event) => onMessage(event.data);
    created.onerror = unexpectedEnd;
    created.onmessageerror = unexpectedEnd;
    timer = setTimeout(() => fail(options.reasons.tookTooLong), readyTimeoutMs);
    inputBuffer =
      options.isolated && typeof SharedArrayBuffer === 'function' ? createInputBuffer() : undefined;
    created.postMessage(
      inputBuffer
        ? { type: 'init', base: options.base, input: inputBuffer }
        : { type: 'init', base: options.base },
    );
  }

  return {
    start: begin,
    run(code) {
      if (state.name !== 'ready' || !worker) return;
      options.console.clear();
      setState({ name: 'running' });
      worker.postMessage({ type: 'run', code });
    },
    answer(line) {
      if (!waiting || !inputBuffer) return;
      // Like a terminal, the answer follows the prompt on the same line.
      options.console.write(`${line}\n`, 'stdout');
      setWaiting(false);
      sendLine(inputBuffer, line);
    },
    retry() {
      if (state.name !== 'failed') return;
      stopWorker();
      begin();
    },
    dispose: stopWorker,
    state: () => state,
  };
}
