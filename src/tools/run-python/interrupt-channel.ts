// Pyodide's interrupt buffer (`setInterruptBuffer`, ADR-0009): one byte the page and the
// worker share. The page writes 2 (SIGINT); Python raises KeyboardInterrupt at its next
// check and Pyodide puts the byte back to 0. Like the typing channel it needs a
// SharedArrayBuffer, so it exists only on an isolated page.
//
// It ends a Program that is running Python. It cannot wake a worker blocked in input();
// input-channel.ts does that.

const sigint = 2;

export const createInterruptBuffer = () => new SharedArrayBuffer(4);

/** The page's side: the next time Python looks, it raises KeyboardInterrupt. */
export function requestInterrupt(buffer: SharedArrayBuffer) {
  Atomics.store(new Uint8Array(buffer), 0, sigint);
}

/** Clears an interrupt Python did not take (Stop pressed as the Program ended). */
export function clearInterrupt(buffer: SharedArrayBuffer) {
  Atomics.store(new Uint8Array(buffer), 0, 0);
}

export const interruptRequested = (buffer: SharedArrayBuffer) =>
  Atomics.load(new Uint8Array(buffer), 0) === sigint;
