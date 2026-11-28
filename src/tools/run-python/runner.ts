// The page's side of a Run: it starts the Python worker, tracks whether Python is
// getting ready, ready, running or failed, sends a Program and passes what comes back to
// the Console. It takes the worker as an argument (`makeWorker`), so Vitest passes a
// fake; Practice.svelte passes the real blob worker.
//
// Seams for the tickets after this one (#126 to #129): add the message in messages.ts, send it from a new method here,
// and turn what comes back in `onMessage` into a state change or a Console call.

import type { Stream } from './console-buffer';
import { createInputBuffer, resetInput, sendLine, sendStop } from './input-channel';
import { clearInterrupt, createInterruptBuffer, requestInterrupt } from './interrupt-channel';
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
  /**
   * `restarted`: a fresh Python is loading after Stop or a death, so Run may be pressed
   * and waits (`queued`) for it. On the first load Run is not available.
   */
  | { name: 'gettingReady'; restarted?: boolean; queued?: boolean }
  | { name: 'ready' }
  | { name: 'running' }
  /** Stop was pressed and Python has not yet ended the Program. */
  | { name: 'stopping' }
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
  reasons: { didNotStart: string; tookTooLong: string };
  /**
   * The page's own words in the Console: at the end of a Run (after a good one, after a
   * missing module, after Stop, and when the worker died), and when input() can't wait for
   * typing here.
   */
  words: { done: string; missingModule: string; noInput: string; stopped: string; died: string };
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
  /**
   * Ends a Program that is running (ADR-0009). With isolation, Python is interrupted and
   * the worker stays; without, or if the Program is still running `stopGraceMs` later, the
   * worker is ended and a fresh one starts at once. A Run pressed before it is ready waits.
   */
  stop(): void;
  /** Sends the typed line to the waiting Program, and shows it in the Console as a line. */
  answer(line: string): void;
  /** After a failure: starts Python again with a new worker. */
  retry(): void;
  /** Ends the worker, when the page goes away. */
  dispose(): void;
  state(): RunnerState;
}

/** A Program that catches the interrupt and goes on is ended this long after Stop. */
export const stopGraceMs = 3000;

/** Pyodide waits for ever when its files are blocked, so the runner gives up after this. */
export const readyTimeoutMs = 3 * 60 * 1000;

export function createRunner(options: RunnerOptions): Runner {
  let state: RunnerState = { name: 'gettingReady' };
  let worker: WorkerLike | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // After Stop with isolation: ends the worker if Python has not ended the Program.
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  // The memory shared with the worker, for input() and for Stop; absent where the page is
  // not isolated.
  let inputBuffer: SharedArrayBuffer | undefined;
  let interruptBuffer: SharedArrayBuffer | undefined;
  let waiting = false;
  // The Program a visitor pressed Run for while a fresh Python was loading.
  let queued: string | undefined;

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
    clearTimeout(stopTimer);
    timer = stopTimer = undefined;
    queued = undefined;
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

  /**
   * The worker ended without being asked. Before Python is ready, that is a failure the
   * visitor can try again. Once it is ready, the page starts a fresh worker itself (only
   * once, so a worker that dies at once cannot loop), and says so if a Program was running.
   */
  function unexpectedEnd() {
    if (state.name === 'gettingReady' || state.name === 'failed') {
      fail(options.reasons.didNotStart);
      return;
    }
    const hadProgram = state.name === 'running' || state.name === 'stopping';
    stopWorker();
    if (hadProgram) options.console.write(`${options.words.died}\n`, 'note');
    begin(true);
  }

  /** Ends a Program the worker will not end itself, and starts a fresh worker. */
  function endWorker() {
    stopWorker();
    options.console.write(`${options.words.stopped}\n`, 'note');
    begin(true);
  }

  function stopped() {
    clearTimeout(stopTimer);
    stopTimer = undefined;
    options.console.write(`${options.words.stopped}\n`, 'note');
    setState({ name: 'ready' });
  }

  function start(code: string) {
    // Start clean: an interrupt Python never took, or a stop nobody was waiting for, must
    // not end this Program at once.
    if (interruptBuffer) clearInterrupt(interruptBuffer);
    if (inputBuffer) resetInput(inputBuffer);
    options.console.clear();
    setState({ name: 'running' });
    worker?.postMessage({ type: 'run', code });
  }

  function onMessage(data: unknown) {
    const message = parseFromWorker(data);
    if (!message) return;
    switch (message.type) {
      case 'ready':
        if (state.name !== 'gettingReady') return;
        clearTimeout(timer);
        setState({ name: 'ready' });
        if (queued !== undefined) {
          const code = queued;
          queued = undefined;
          start(code);
        }
        return;
      case 'out':
        if (state.name === 'running' || state.name === 'stopping')
          options.console.write(message.text, message.stream);
        return;
      case 'input':
        // Only a Program that is running, on a page that gave it somewhere to wait.
        if (state.name === 'running' && inputBuffer) setWaiting(true);
        return;
      case 'inputUnavailable':
        if (state.name === 'running') options.console.write(`${options.words.noInput}\n`, 'note');
        return;
      case 'done':
        if (state.name !== 'running' && state.name !== 'stopping') return;
        setWaiting(false);
        // Stop, or the Program raising KeyboardInterrupt itself, or a Program that caught
        // the interrupt and ended well after Stop: the Console says Stopped., not Done.
        if (state.name === 'stopping' || message.outcome === 'stopped') {
          stopped();
          return;
        }
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

  function begin(restarted = false) {
    setState(restarted ? { name: 'gettingReady', restarted } : { name: 'gettingReady' });
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
    const shared = options.isolated && typeof SharedArrayBuffer === 'function';
    inputBuffer = shared ? createInputBuffer() : undefined;
    interruptBuffer = shared ? createInterruptBuffer() : undefined;
    created.postMessage(
      inputBuffer && interruptBuffer
        ? { type: 'init', base: options.base, input: inputBuffer, interrupt: interruptBuffer }
        : { type: 'init', base: options.base },
    );
  }

  return {
    start: begin,
    run(code) {
      if (state.name === 'gettingReady' && state.restarted && queued === undefined) {
        // A fresh Python is loading: keep the Program, and run it when it is ready.
        queued = code;
        setState({ name: 'gettingReady', restarted: true, queued: true });
        return;
      }
      if (state.name !== 'ready' || !worker) return;
      start(code);
    },
    stop() {
      if (state.name !== 'running') return;
      if (!inputBuffer || !interruptBuffer) {
        // Nothing can interrupt Python from outside without shared memory.
        endWorker();
        return;
      }
      // The interrupt first: when Stop wakes input(), Python finds it waiting.
      requestInterrupt(interruptBuffer);
      if (waiting) {
        setWaiting(false);
        sendStop(inputBuffer);
      }
      setState({ name: 'stopping' });
      stopTimer = setTimeout(endWorker, stopGraceMs);
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
