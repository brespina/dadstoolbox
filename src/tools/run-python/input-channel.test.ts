import { describe, expect, it, vi } from 'vitest';
import {
  createInputBuffer,
  createStdin,
  inputBytes,
  sendLine,
  sendStop,
  waitForLine,
} from './input-channel';

describe('the typing channel', () => {
  it('carries a line from the page to the one waiting for it', () => {
    const buffer = createInputBuffer();
    sendLine(buffer, 'Ada');
    expect(waitForLine(buffer)).toBe('Ada');
  });

  it('keeps letters beyond ASCII whole', () => {
    const buffer = createInputBuffer();
    sendLine(buffer, 'Zoë 名前 🙂');
    expect(waitForLine(buffer)).toBe('Zoë 名前 🙂');
  });

  it('carries an empty line', () => {
    const buffer = createInputBuffer();
    sendLine(buffer, '');
    expect(waitForLine(buffer)).toBe('');
  });

  it('serves a second wait after a second line', () => {
    const buffer = createInputBuffer();
    sendLine(buffer, 'one');
    expect(waitForLine(buffer)).toBe('one');
    sendLine(buffer, 'two, longer');
    expect(waitForLine(buffer)).toBe('two, longer');
    sendLine(buffer, 'x');
    // Nothing of the longer line is left behind.
    expect(waitForLine(buffer)).toBe('x');
  });

  it('holds a line as long as the typing field allows', () => {
    const buffer = createInputBuffer();
    const longest = '🙂'.repeat(2000);
    sendLine(buffer, longest);
    expect(waitForLine(buffer)).toBe(longest);
  });

  it('cuts a line that is too long for the buffer rather than overflowing', () => {
    const buffer = createInputBuffer();
    sendLine(buffer, 'a'.repeat(inputBytes * 2));
    expect(waitForLine(buffer)!.length).toBeLessThanOrEqual(inputBytes);
  });
});

describe('Stop, for a Program waiting at input()', () => {
  it('wakes a wait with nothing, and the next line is not lost', () => {
    const buffer = createInputBuffer();
    sendStop(buffer);
    expect(waitForLine(buffer)).toBeUndefined();
    // The stop was taken: it does not end the next wait as well.
    sendLine(buffer, 'Ada');
    expect(waitForLine(buffer)).toBe('Ada');
  });

  it('wakes a wait that is already blocked', async () => {
    const buffer = createInputBuffer();
    const { Worker } = await import('node:worker_threads');
    const worker = new Worker(
      `const { workerData, parentPort } = require('node:worker_threads');
       const header = new Int32Array(workerData, 0, 2);
       parentPort.postMessage('waiting');
       while (Atomics.load(header, 0) === 0) Atomics.wait(header, 0, 0);
       parentPort.postMessage('woke with state ' + Atomics.load(header, 0));`,
      { eval: true, workerData: buffer },
    );
    const said = new Promise<string[]>((resolve) => {
      const messages: string[] = [];
      worker.on('message', (message: string) => {
        messages.push(message);
        if (messages.length === 2) resolve(messages);
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    sendStop(buffer);
    expect(await said).toEqual(['waiting', 'woke with state 2']);
    await worker.terminate();
  });

  it('ends a wait when the interrupt is seen, even if the wake was missed', () => {
    const buffer = createInputBuffer();
    let looks = 0;
    expect(waitForLine(buffer, () => ++looks >= 2)).toBeUndefined();
    expect(looks).toBe(2);
  });
});

describe('the worker side of input()', () => {
  it('lets Python end the Program when Stop comes while it waits', () => {
    const buffer = createInputBuffer();
    const calls: string[] = [];
    const stdin = createStdin(buffer, {
      waiting: () => {
        calls.push('waiting');
        sendStop(buffer);
      },
      unavailable: () => calls.push('unavailable'),
      // Python raises KeyboardInterrupt here; if it did not, the end of input follows.
      stopped: () => calls.push('stopped'),
    });
    expect(stdin()).toBeUndefined();
    expect(calls).toEqual(['waiting', 'stopped']);
  });

  it('says it is waiting, then returns the line', () => {
    const buffer = createInputBuffer();
    const calls: string[] = [];
    const stdin = createStdin(buffer, {
      // The page answers some time after it hears this.
      waiting: () => {
        calls.push('waiting');
        sendLine(buffer, 'Ada');
      },
      unavailable: () => calls.push('unavailable'),
    });
    expect(stdin()).toBe('Ada');
    expect(calls).toEqual(['waiting']);
  });

  it('waits again for a second call', () => {
    const buffer = createInputBuffer();
    const lines = ['one', 'two'];
    const stdin = createStdin(buffer, {
      waiting: () => sendLine(buffer, lines.shift()!),
      unavailable: vi.fn(),
    });
    expect([stdin(), stdin()]).toEqual(['one', 'two']);
  });

  it('without a buffer, says so, and returns nothing: the end of input', () => {
    const calls: string[] = [];
    const stdin = createStdin(undefined, {
      waiting: () => calls.push('waiting'),
      unavailable: () => calls.push('unavailable'),
    });
    expect(stdin()).toBeUndefined();
    expect(calls).toEqual(['unavailable']);
  });
});
