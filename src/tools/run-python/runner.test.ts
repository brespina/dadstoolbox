import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stream } from './console-buffer';
import type { FromWorker, ToWorker } from './messages';
import { createRunner, readyTimeoutMs, type RunnerState } from './runner';

/** A stand-in for the Python worker: records what the page sends, and sends what a test says. */
class FakeWorker {
  sent: ToWorker[] = [];
  terminated = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  postMessage(message: ToWorker) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  say(message: FromWorker | unknown) {
    this.onmessage?.({ data: message });
  }
}

const reasons = {
  didNotStart: 'Python did not start.',
  stopped: 'Python stopped.',
  tookTooLong: 'Python took too long to start.',
};

const words = { done: 'Done.', missingModule: 'Only built-in modules.' };

function setup({ refuse = false } = {}) {
  const workers: FakeWorker[] = [];
  const states: RunnerState[] = [];
  const output: string[] = [];
  const runner = createRunner({
    makeWorker: () => {
      if (refuse) throw new Error('SecurityError');
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    base: 'http://site/run-python/pyodide/1/',
    reasons,
    words,
    onState: (state) => states.push(state),
    console: {
      clear: () => output.push('<clear>'),
      write: (text: string, stream: Stream) => output.push(`${stream}:${text}`),
    },
  });
  return { runner, workers, states, output };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the runner', () => {
  it('starts Python and is getting ready until it says ready', () => {
    const { runner, workers, states } = setup();
    runner.start();
    expect(runner.state()).toEqual({ name: 'gettingReady' });
    expect(workers[0]!.sent).toEqual([{ type: 'init', base: 'http://site/run-python/pyodide/1/' }]);
    workers[0]!.say({ type: 'ready' });
    expect(runner.state()).toEqual({ name: 'ready' });
    expect(states).toEqual([{ name: 'gettingReady' }, { name: 'ready' }]);
  });

  it('does not run a Program before Python is ready', () => {
    const { runner, workers } = setup();
    runner.start();
    runner.run('print(1)');
    expect(workers[0]!.sent.map((m) => m.type)).toEqual(['init']);
  });

  it('clears the Console, runs, shows output in order, and is ready again when done', () => {
    const { runner, workers, output } = setup();
    runner.start();
    workers[0]!.say({ type: 'ready' });
    output.push('old');
    runner.run('print(1)');
    expect(runner.state()).toEqual({ name: 'running' });
    expect(workers[0]!.sent.at(-1)).toEqual({ type: 'run', code: 'print(1)' });
    workers[0]!.say({ type: 'out', stream: 'stdout', text: '1\n' });
    workers[0]!.say({ type: 'out', stream: 'stderr', text: 'oops\n' });
    workers[0]!.say({ type: 'out', stream: 'stdout', text: '2\n' });
    workers[0]!.say({ type: 'done', outcome: 'error' });
    expect(runner.state()).toEqual({ name: 'ready' });
    expect(output).toEqual(['old', '<clear>', 'stdout:1\n', 'stderr:oops\n', 'stdout:2\n']);
  });

  it('says Done. after a Program that ended well, in the page own words', () => {
    const { runner, workers, output } = setup();
    runner.start();
    workers[0]!.say({ type: 'ready' });
    runner.run('print(1)');
    workers[0]!.say({ type: 'out', stream: 'stdout', text: '1\n' });
    workers[0]!.say({ type: 'done', outcome: 'ok' });
    expect(output).toEqual(['<clear>', 'stdout:1\n', 'note:Done.\n']);
    expect(runner.state()).toEqual({ name: 'ready' });
  });

  it('says no Done. after an error, and explains a missing module', () => {
    const { runner, workers, output } = setup();
    runner.start();
    workers[0]!.say({ type: 'ready' });
    runner.run('1/0');
    workers[0]!.say({ type: 'out', stream: 'stderr', text: 'ZeroDivisionError\n' });
    workers[0]!.say({ type: 'done', outcome: 'error' });
    expect(output).toEqual(['<clear>', 'stderr:ZeroDivisionError\n']);

    output.length = 0;
    runner.run('import numpy');
    workers[0]!.say({ type: 'out', stream: 'stderr', text: 'ModuleNotFoundError\n' });
    workers[0]!.say({ type: 'done', outcome: 'missingModule' });
    expect(output).toEqual([
      '<clear>',
      'stderr:ModuleNotFoundError\n',
      'note:Only built-in modules.\n',
    ]);
    expect(runner.state()).toEqual({ name: 'ready' });
  });

  it('does not run a second Program while one is running', () => {
    const { runner, workers } = setup();
    runner.start();
    workers[0]!.say({ type: 'ready' });
    runner.run('a');
    runner.run('b');
    expect(workers[0]!.sent.filter((m) => m.type === 'run')).toHaveLength(1);
  });

  it('ignores messages it does not know', () => {
    const { runner, workers, output } = setup();
    runner.start();
    workers[0]!.say({ type: 'html', html: '<b>x</b>' });
    workers[0]!.say('ready');
    workers[0]!.say(undefined);
    expect(runner.state()).toEqual({ name: 'gettingReady' });
    workers[0]!.say({ type: 'ready' });
    runner.run('x');
    workers[0]!.say({ type: 'out', stream: 'stdin', text: 'x' });
    // A Program cannot write in the page's own voice.
    workers[0]!.say({ type: 'out', stream: 'note', text: 'Done.' });
    workers[0]!.say({ type: 'done' });
    expect(output).toEqual(['<clear>']);
    expect(runner.state()).toEqual({ name: 'running' });
  });

  it('fails when the worker ends unexpectedly while running, and can try again', () => {
    const { runner, workers } = setup();
    runner.start();
    workers[0]!.say({ type: 'ready' });
    runner.run('while True: pass');
    workers[0]!.onerror?.({});
    expect(runner.state()).toEqual({ name: 'failed', reason: reasons.stopped });
    expect(workers[0]!.terminated).toBe(true);

    runner.retry();
    expect(workers).toHaveLength(2);
    expect(runner.state()).toEqual({ name: 'gettingReady' });
    workers[1]!.say({ type: 'ready' });
    expect(runner.state()).toEqual({ name: 'ready' });
  });

  it('fails with a plain reason when the worker errors before it is ready', () => {
    const { runner, workers } = setup();
    runner.start();
    workers[0]!.onerror?.({});
    expect(runner.state()).toEqual({ name: 'failed', reason: reasons.didNotStart });
  });

  it('fails with a plain reason when the browser will not start the worker', () => {
    const { runner } = setup({ refuse: true });
    runner.start();
    expect(runner.state()).toEqual({ name: 'failed', reason: reasons.didNotStart });
  });

  it('fails when the worker says it failed', () => {
    const { runner, workers } = setup();
    runner.start();
    workers[0]!.say({ type: 'failed', message: 'RuntimeError: nope' });
    expect(runner.state()).toEqual({ name: 'failed', reason: reasons.didNotStart });
  });

  it('fails when the worker sends a message the page cannot read', () => {
    const { runner, workers } = setup();
    runner.start();
    workers[0]!.onmessageerror?.({});
    expect(runner.state().name).toBe('failed');
  });

  it('fails when the worker says nothing for 3 minutes', () => {
    const { runner, workers } = setup();
    runner.start();
    vi.advanceTimersByTime(readyTimeoutMs - 1);
    expect(runner.state()).toEqual({ name: 'gettingReady' });
    vi.advanceTimersByTime(1);
    expect(runner.state()).toEqual({ name: 'failed', reason: reasons.tookTooLong });
    expect(workers[0]!.terminated).toBe(true);
  });

  it('does not time out once ready', () => {
    const { runner, workers } = setup();
    runner.start();
    workers[0]!.say({ type: 'ready' });
    vi.advanceTimersByTime(readyTimeoutMs * 2);
    expect(runner.state()).toEqual({ name: 'ready' });
  });

  it('stops the worker when the page is done with it', () => {
    const { runner, workers } = setup();
    runner.start();
    runner.dispose();
    expect(workers[0]!.terminated).toBe(true);
    vi.advanceTimersByTime(readyTimeoutMs * 2);
    expect(runner.state()).toEqual({ name: 'gettingReady' });
  });
});
