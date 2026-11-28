import { describe, expect, it } from 'vitest';
import { parseFromWorker, parseToWorker } from './messages';

describe('messages from the worker', () => {
  it('accepts each message the worker sends', () => {
    for (const message of [
      { type: 'ready' },
      { type: 'out', stream: 'stdout', text: 'hi\n' },
      { type: 'out', stream: 'stderr', text: '' },
      { type: 'done' },
      { type: 'failed', message: 'It did not start.' },
    ]) {
      expect(parseFromWorker(message)).toEqual(message);
    }
  });

  it('refuses unknown, malformed and non-object messages', () => {
    for (const data of [
      undefined,
      null,
      'ready',
      42,
      [],
      {},
      { type: 'html', html: '<b>hi</b>' },
      { type: 'out' },
      { type: 'out', stream: 'stdin', text: 'x' },
      { type: 'out', stream: 'stdout', text: 5 },
      { type: 'failed' },
      { type: 'failed', message: {} },
      // A message meant for the worker is not one from it.
      { type: 'run', code: 'print(1)' },
    ]) {
      expect(parseFromWorker(data), JSON.stringify(data)).toBeUndefined();
    }
  });

  it('drops fields it does not know', () => {
    expect(parseFromWorker({ type: 'done', extra: 1 })).toEqual({ type: 'done' });
  });
});

describe('messages to the worker', () => {
  it('accepts init and run', () => {
    expect(parseToWorker({ type: 'init', base: 'http://x/pyodide/' })).toEqual({
      type: 'init',
      base: 'http://x/pyodide/',
    });
    expect(parseToWorker({ type: 'run', code: 'print(1)' })).toEqual({
      type: 'run',
      code: 'print(1)',
    });
  });

  it('refuses unknown and malformed messages', () => {
    for (const data of [
      undefined,
      {},
      { type: 'init' },
      { type: 'init', base: 4 },
      { type: 'run', code: null },
      { type: 'ready' },
      { type: 'stop' },
    ]) {
      expect(parseToWorker(data), JSON.stringify(data)).toBeUndefined();
    }
  });
});
