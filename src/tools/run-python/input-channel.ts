// How a typed line gets from the page to a Program waiting in input() (ADR-0009). Python
// runs in a worker and input() must not return until the visitor types, so the worker
// waits (`Atomics.wait`) on a SharedArrayBuffer the page also holds. The page writes the
// line into it and wakes the worker. That only exists on a cross-origin isolated page.
//
// The buffer: four bytes of state, four of length, then the line as UTF-8.
//
//   state 0 (idle)   the worker is waiting, or has not asked yet
//   state 1 (line)   the page has written a line for the worker to take
//   state 2 (stop)   the page pressed Stop: the worker wakes with no line, and Python ends
//                    the Program with KeyboardInterrupt (see `createStdin`)
//
// Stop also writes 2 into Pyodide's own interrupt buffer (interrupt-channel.ts), which
// ends a Program that is running Python. That buffer cannot wake a worker blocked in
// `Atomics.wait`, so the state above does.
//
// Pyodide's stdin function runs with Python's lock released, so it cannot call Python. It
// need not flush the prompt: Python's own input() sends what was printed before it reads
// (helper.test.ts checks this).

/** The size of the whole buffer. A line's bytes are what is left after the 8 header bytes. */
export const inputBytes = 8 * 1024;
const headerBytes = 8;

const idle = 0;
const lineReady = 1;
const stopRequested = 2;

/** How often a wait looks again at the interrupt, in case a wake was missed. */
const lookEveryMs = 100;

export const createInputBuffer = () => new SharedArrayBuffer(inputBytes);

/** The page's side: writes a line and wakes the worker. Too long a line is cut, not overflowed. */
export function sendLine(buffer: SharedArrayBuffer, line: string) {
  const header = new Int32Array(buffer, 0, 2);
  const bytes = new TextEncoder().encode(line).subarray(0, inputBytes - headerBytes);
  // Write into a window of the shared bytes: `encodeInto` refuses shared memory.
  new Uint8Array(buffer, headerBytes).set(bytes);
  Atomics.store(header, 1, bytes.length);
  // The state goes last: the worker reads the line only once it sees this.
  Atomics.store(header, 0, lineReady);
  Atomics.notify(header, 0);
}

/** The page's side of Stop: wakes a worker that waits for a line, which then gets none. */
export function sendStop(buffer: SharedArrayBuffer) {
  const header = new Int32Array(buffer, 0, 2);
  Atomics.store(header, 0, stopRequested);
  Atomics.notify(header, 0);
}

/** Puts the buffer back to waiting for a line. The page does it before each Run. */
export function resetInput(buffer: SharedArrayBuffer) {
  Atomics.store(new Int32Array(buffer, 0, 2), 0, idle);
}

/**
 * The worker's side: blocks until the page sends a line, and returns it. Returns nothing
 * when Stop woke it, or when `interrupted` says the interrupt is set (it is asked every
 * 100 ms, so a missed wake costs a moment and no more).
 */
export function waitForLine(
  buffer: SharedArrayBuffer,
  interrupted: () => boolean = () => false,
): string | undefined {
  const header = new Int32Array(buffer, 0, 2);
  while (Atomics.load(header, 0) === idle) {
    if (interrupted()) return undefined;
    Atomics.wait(header, 0, idle, lookEveryMs);
  }
  if (Atomics.load(header, 0) === stopRequested) {
    Atomics.store(header, 0, idle);
    return undefined;
  }
  const length = Atomics.load(header, 1);
  // `slice` copies out of shared memory: TextDecoder refuses a view on it.
  const bytes = new Uint8Array(buffer, headerBytes, length).slice();
  Atomics.store(header, 0, idle);
  return new TextDecoder().decode(bytes);
}

export interface StdinHooks {
  /** Tells the page the Program is waiting for a typed line. */
  waiting(): void;
  /** Tells the page this browser cannot wait for typing. */
  unavailable(): void;
  /** True while the page's interrupt is set (Pyodide's interrupt buffer holds 2). */
  interrupted?(): boolean;
  /**
   * Stop woke the wait. Python ends the Program here: the worker calls
   * `pyodide.checkInterrupt()`, which raises KeyboardInterrupt out of input(). It is the
   * only Python call a stdin function can make (the rest are refused without the lock).
   */
  stopped?(): void;
}

/**
 * The function Pyodide calls for input(). Without a buffer it says so and returns
 * nothing, which Python takes as the end of input and raises EOFError.
 */
export function createStdin(buffer: SharedArrayBuffer | undefined, hooks: StdinHooks) {
  return (): string | undefined => {
    if (!buffer) {
      hooks.unavailable();
      return undefined;
    }
    hooks.waiting();
    const line = waitForLine(buffer, hooks.interrupted);
    if (line === undefined) {
      hooks.stopped?.();
      // Not reached when Python raised: otherwise the end of input, and the interrupt
      // that is still set ends the Program a moment later.
    }
    return line;
  };
}
