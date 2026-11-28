import { describe, expect, it, vi } from 'vitest';
import { createInputBuffer, createStdin, inputBytes, sendLine, waitForLine } from './input-channel';

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

describe('the worker side of input()', () => {
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
