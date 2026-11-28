import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stream } from './console-buffer';
import type { FromWorker, ToWorker } from './messages';
import { waitForLine } from './input-channel';
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

const words = {
  done: 'Done.',
  missingModule: 'Only built-in modules.',
  noInput: "input() doesn't work here.",
};

function setup({ refuse = false, isolated = false } = {}) {
  const workers: FakeWorker[] = [];
  const states: RunnerState[] = [];
  const output: string[] = [];
  const waiting: boolean[] = [];
  const runner = createRunner({
    isolated,
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
    onInput: (is) => waiting.push(is),
    console: {
      clear: () => output.push('<clear>'),
      write: (text: string, stream: Stream) => output.push(`${stream}:${text}`),
    },
  });
  return { runner, workers, states, output, waiting };
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

describe('the runner and input()', () => {
  /** An isolated runner with a Program running. */
  function running() {
    const made = setup({ isolated: true });
    made.runner.start();
    made.workers[0]!.say({ type: 'ready' });
    made.runner.run('name = input()');
    const init = made.workers[0]!.sent[0] as Extract<ToWorker, { type: 'init' }>;
    return { ...made, worker: made.workers[0]!, buffer: init.input! };
  }

  it('gives the worker the typing buffer only on an isolated page', () => {
    const isolated = setup({ isolated: true });
    isolated.runner.start();
    expect(isolated.workers[0]!.sent[0]).toEqual({
      type: 'init',
      base: 'http://site/run-python/pyodide/1/',
      input: expect.any(SharedArrayBuffer),
    });
    const plain = setup();
    plain.runner.start();
    expect(plain.workers[0]!.sent[0]).toEqual({
      type: 'init',
      base: 'http://site/run-python/pyodide/1/',
    });
    expect('input' in plain.workers[0]!.sent[0]!).toBe(false);
  });

  it('shows the field when the Program waits, and a typed answer reaches the worker', () => {
    const { runner, worker, buffer, output, waiting } = running();
    worker.say({ type: 'out', stream: 'stdout', text: 'Name: ' });
    worker.say({ type: 'input' });
    expect(waiting).toEqual([true]);
    runner.answer('Ada');
    // The answer is a normal line after the prompt, and the field goes away.
    expect(output).toEqual(['<clear>', 'stdout:Name: ', 'stdout:Ada\n']);
    expect(waiting).toEqual([true, false]);
    expect(waitForLine(buffer)).toBe('Ada');
  });

  it('waits again for a second input()', () => {
    const { runner, worker, buffer, waiting } = running();
    worker.say({ type: 'input' });
    runner.answer('one');
    expect(waitForLine(buffer)).toBe('one');
    worker.say({ type: 'input' });
    expect(waiting).toEqual([true, false, true]);
    runner.answer('two');
    expect(waitForLine(buffer)).toBe('two');
    expect(waiting).toEqual([true, false, true, false]);
  });

  it('takes an answer only while the Program waits, and only once', () => {
    const { runner, worker, buffer, output } = running();
    runner.answer('too early');
    worker.say({ type: 'input' });
    runner.answer('first');
    runner.answer('second');
    expect(output).toEqual(['<clear>', 'stdout:first\n']);
    expect(waitForLine(buffer)).toBe('first');
  });

  it('ignores a wait it never asked for', () => {
    const { runner, workers, waiting } = setup({ isolated: true });
    runner.start();
    workers[0]!.say({ type: 'input' });
    workers[0]!.say({ type: 'ready' });
    workers[0]!.say({ type: 'input' });
    expect(waiting).toEqual([]);
    const plain = setup();
    plain.runner.start();
    plain.workers[0]!.say({ type: 'ready' });
    plain.runner.run('input()');
    plain.workers[0]!.say({ type: 'input' });
    expect(plain.waiting).toEqual([]);
  });

  it('puts the field away when the Program ends, or Python fails', () => {
    const ended = running();
    ended.worker.say({ type: 'input' });
    ended.worker.say({ type: 'done', outcome: 'error' });
    expect(ended.waiting).toEqual([true, false]);

    const failed = running();
    failed.worker.say({ type: 'input' });
    failed.worker.onerror?.({});
    expect(failed.waiting).toEqual([true, false]);
  });

  it('says in the page own words that input() cannot work here', () => {
    const { runner, workers, output } = setup();
    runner.start();
    workers[0]!.say({ type: 'ready' });
    runner.run('input()');
    workers[0]!.say({ type: 'inputUnavailable' });
    workers[0]!.say({ type: 'out', stream: 'stderr', text: 'EOFError\n' });
    workers[0]!.say({ type: 'done', outcome: 'error' });
    expect(output).toEqual(['<clear>', "note:input() doesn't work here.\n", 'stderr:EOFError\n']);
  });
});
