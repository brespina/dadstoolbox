import { describe, expect, it, vi } from 'vitest';
import { createToolPage, type ToolPageState } from './batch';
import { defineTool, ToolFailure, type Reason, type ToolRun } from './types';
import { runInWorker, serveRuns, type AnyRun } from './worker';

const tool = defineTool({
  address: 'fake',
  name: 'Do a fake thing',
  blurb: 'For tests.',
  category: 'Other',
  position: 1,
  noun: { one: 'file', many: 'files' },
  accept: ['.txt'],
  input: 'each',
  needs: [],
  largeFileLimit: 1000,
  startButton: 'Do it',
  worker: false,
  outsideAddresses: [],
  defaultOptions: {},
});

const file = (name: string, size = 10) => new File(['x'.repeat(size)], name);

describe('waiting list', () => {
  it('shows chosen files as Ready, in the order chosen', () => {
    const page = createToolPage(tool, async () => []);
    page.add([file('a.txt'), file('b.txt')]);
    expect(page.state().waiting.map((w) => [w.name, w.status])).toEqual([
      ['a.txt', 'ready'],
      ['b.txt', 'ready'],
    ]);
  });

  it('removes a file without touching the others', () => {
    const page = createToolPage(tool, async () => []);
    page.add([file('a.txt'), file('b.txt'), file('c.txt')]);
    const b = page.state().waiting[1]!;
    page.remove(b.id);
    expect(page.state().waiting.map((w) => w.name)).toEqual(['a.txt', 'c.txt']);
  });

  it('flags a file bigger than the declared limit as large', () => {
    const page = createToolPage(tool, async () => []);
    page.add([file('small.txt', 1000), file('big.txt', 1001)]);
    expect(page.state().waiting.map((w) => [w.name, w.large])).toEqual([
      ['small.txt', false],
      ['big.txt', true],
    ]);
  });

  it('empties once start is pressed, and a removed file is never run', async () => {
    const ran: string[] = [];
    const page = createToolPage(tool, async (f) => {
      ran.push(f.name);
      return [];
    });
    page.add([file('a.txt'), file('b.txt')]);
    page.remove(page.state().waiting[0]!.id);
    await page.start({});
    expect(ran).toEqual(['b.txt']);
    expect(page.state().waiting).toEqual([]);
  });
});

const pdf = (detail?: string) => ({
  blob: new Blob(['%PDF'], { type: 'application/pdf' }),
  detail,
});

describe('a Batch', () => {
  it('has a row per file that ends Done, with its results named after the original', async () => {
    const page = createToolPage(tool, async () => [pdf('page1'), pdf('page2')]);
    page.add([file('report.pdf', 3800)]);
    await page.start({});
    const [batch] = page.state().batches;
    expect(batch!.items).toMatchObject([
      {
        name: 'report.pdf',
        size: 3800,
        status: 'done',
        results: [
          { name: 'report_dtb_page1.pdf', size: 4 },
          { name: 'report_dtb_page2.pdf', size: 4 },
        ],
      },
    ]);
  });
});

describe('watching a Batch', () => {
  it('reports each row going Ready → Working… → Done, with progress counts', async () => {
    const page = createToolPage(tool, async () => [pdf()]);
    const seen: ToolPageState[] = [];
    page.subscribe((state) => seen.push(state));
    page.add([file('a.pdf'), file('b.pdf')]);
    await page.start({});

    const during = seen.filter((s) => s.batches.length > 0);
    const statusesOf = (index: number) => [
      ...new Set(during.map((s) => s.batches[0]!.items[index]!.status)),
    ];
    expect(statusesOf(0)).toEqual(['ready', 'working', 'done']);
    expect(statusesOf(1)).toEqual(['ready', 'working', 'done']);
    expect([...new Set(during.map((s) => JSON.stringify(s.batches[0]!.progress)))]).toEqual([
      JSON.stringify({ current: 1, total: 2 }),
      JSON.stringify({ current: 2, total: 2 }),
      'null',
    ]);
  });

  it('shows how far along the working row is, as a whole percent', async () => {
    const percents: (number | undefined)[][] = [];
    const page = createToolPage(tool, async (_f, _options, context) => {
      for (const fraction of [0, 0.401, 0.404, 0.75, 1]) context!.progress(fraction);
      return [pdf()];
    });
    page.subscribe(
      (state) => state.batches[0] && percents.push(state.batches[0].items.map((i) => i.percent)),
    );
    page.add([file('a.pdf'), file('b.pdf')]);
    await page.start({});
    const first = [...new Set(percents.map(([a]) => a))];
    const second = [...new Set(percents.map(([, b]) => b))];
    expect(first).toEqual([undefined, 0, 40, 75, 100]);
    expect(second).toEqual([undefined, 0, 40, 75, 100]);
  });

  it('shows Getting ready while a Tool waits for something to load, then carries on', async () => {
    let loaded!: () => void;
    const loading = new Promise<void>((resolve) => (loaded = resolve));
    const page = createToolPage(tool, async (_file, _options, context) => {
      await context!.gettingReady(loading);
      return [pdf()];
    });
    page.add([file('a.pdf')]);
    const started = page.start({});
    await Promise.resolve();
    expect(page.state().batches[0]!.gettingReady).toBe(true);
    loaded();
    await started;
    expect(page.state().batches[0]!.gettingReady).toBe(false);
    expect(page.state().batches[0]!.items[0]!.status).toBe('done');
  });

  it('labels each Batch with how many files it holds', async () => {
    const page = createToolPage(tool, async () => [pdf()]);
    page.add([file('a.pdf')]);
    await page.start({});
    page.add([file('b.pdf'), file('c.pdf')]);
    await page.start({});
    expect(page.state().batches.map((b) => b.label)).toEqual(['2 files', '1 file']);
  });

  it('stops telling a listener once it unsubscribes', () => {
    const page = createToolPage(tool, async () => []);
    let calls = 0;
    const stop = page.subscribe(() => calls++);
    page.add([file('a.pdf')]);
    stop();
    page.add([file('b.pdf')]);
    expect(calls).toBe(1);
  });
});

describe('Save all', () => {
  it('covers every result of the newest Batch only', async () => {
    const page = createToolPage(tool, async () => [pdf('page1'), pdf('page2')]);
    page.add([file('old.pdf')]);
    await page.start({});
    page.add([file('a.pdf'), file('b.pdf')]);
    await page.start({});
    expect(page.saveAllFiles().map((r) => r.name)).toEqual([
      'a_dtb_page1.pdf',
      'a_dtb_page2.pdf',
      'b_dtb_page1.pdf',
      'b_dtb_page2.pdf',
    ]);
  });

  it('has nothing to save before any Batch', () => {
    expect(createToolPage(tool, async () => []).saveAllFiles()).toEqual([]);
  });
});

describe('a file that fails', () => {
  const runFailing = (error: Error) => async (f: File) => {
    if (f.name === 'bad.pdf') throw error;
    return [pdf()];
  };

  it("shows the Tool's own reason on its row only, and other files carry on", async () => {
    const page = createToolPage(
      tool,
      runFailing(new ToolFailure('This PDF has a password.' as Reason)),
    );
    page.add([file('bad.pdf'), file('good.pdf')]);
    await page.start({});
    expect(page.state().batches[0]!.items).toMatchObject([
      { name: 'bad.pdf', status: 'failed', reason: 'This PDF has a password.', results: [] },
      { name: 'good.pdf', status: 'done', results: [{ name: 'good_dtb.pdf' }] },
    ]);
  });
});

describe('pressing start again', () => {
  const labelled = defineTool({
    ...tool,
    textFor: (options: { format: string }) => ({ batchLabel: options.format.toUpperCase() }),
    defaultOptions: { format: 'jpg' },
  });
  const recording = () => {
    const runs: string[] = [];
    const run = async (f: File, options: { format: string }) => {
      runs.push(`${f.name} ${options.format}`);
      return [pdf()];
    };
    return { runs, page: createToolPage(labelled, run) };
  };

  it('with changed options runs every chosen file again, in a new Batch on top', async () => {
    const { runs, page } = recording();
    page.add([file('a.pdf'), file('b.pdf')]);
    await page.start({ format: 'jpg' });
    await page.start({ format: 'png' });
    expect(runs).toEqual(['a.pdf jpg', 'b.pdf jpg', 'a.pdf png', 'b.pdf png']);
    expect(page.state().batches.map((b) => b.label)).toEqual(['PNG · 2 files', 'JPG · 2 files']);
  });

  it('keeps earlier Batches with their own results, and Save all covers the newest only', async () => {
    const { page } = recording();
    page.add([file('a.pdf')]);
    await page.start({ format: 'jpg' });
    const first = page.state().batches[0]!;
    await page.start({ format: 'png' });
    const [newest, earlier] = page.state().batches;
    expect(earlier).toEqual(first);
    expect(page.saveAllFiles()).toEqual(newest!.items[0]!.results);
  });

  it('after Choose more runs only the new files', async () => {
    const { runs, page } = recording();
    page.add([file('a.pdf')]);
    await page.start({ format: 'jpg' });
    page.add([file('b.pdf')]);
    expect(page.state().waiting.map((w) => [w.name, w.status])).toEqual([['b.pdf', 'ready']]);
    await page.start({ format: 'jpg' });
    expect(runs).toEqual(['a.pdf jpg', 'b.pdf jpg']);
    expect(page.state().batches[0]!.items.map((i) => i.name)).toEqual(['b.pdf']);
  });

  it('after Choose more and changed options runs every file', async () => {
    const { runs, page } = recording();
    page.add([file('a.pdf')]);
    await page.start({ format: 'jpg' });
    page.add([file('b.pdf')]);
    await page.start({ format: 'png' });
    expect(runs).toEqual(['a.pdf jpg', 'a.pdf png', 'b.pdf png']);
  });

  it('has nothing to do once every file has run with these options', async () => {
    const { runs, page } = recording();
    page.add([file('a.pdf')]);
    expect(page.hasWork({ format: 'jpg' })).toBe(true);
    await page.start({ format: 'jpg' });
    await page.start({ format: 'png' });
    expect(page.hasWork({ format: 'jpg' })).toBe(false);
    expect(page.hasWork({ format: 'webp' })).toBe(true);
    await page.start({ format: 'jpg' });
    expect(runs).toEqual(['a.pdf jpg', 'a.pdf png']);
    expect(page.state().batches).toHaveLength(2);
  });

  it('treats options as the same whatever order they were set in', async () => {
    const page = createToolPage({ ...tool, defaultOptions: { a: 1, b: 2 } }, async () => [pdf()]);
    page.add([file('a.pdf')]);
    await page.start({ a: 1, b: 2 });
    expect(page.hasWork({ b: 2, a: 1 })).toBe(false);
  });

  it('does not run a file that did not work again with the same options', async () => {
    const runs: string[] = [];
    const page = createToolPage(labelled, async (f, options) => {
      runs.push(`${f.name} ${options.format}`);
      throw new ToolFailure('No.' as Reason);
    });
    page.add([file('a.pdf')]);
    await page.start({ format: 'jpg' });
    expect(page.hasWork({ format: 'jpg' })).toBe(false);
    page.add([file('a.pdf')]);
    await page.start({ format: 'jpg' });
    expect(runs).toEqual(['a.pdf jpg', 'a.pdf jpg']);
  });

  it("gives each Batch the options' own All done message", async () => {
    const page = createToolPage(
      defineTool({
        ...labelled,
        textFor: (options: { format: string }) =>
          options.format === 'png' ? { allDone: 'All done. PNG.' } : {},
      }),
      async () => [pdf()],
    );
    page.add([file('a.pdf')]);
    await page.start({ format: 'jpg' });
    await page.start({ format: 'png' });
    expect(page.state().batches.map((b) => b.allDone)).toEqual(['All done. PNG.', 'All done.']);
  });
});

describe('result names', () => {
  const namesFrom = async (names: string[], results: () => ReturnType<typeof pdf>[]) => {
    const page = createToolPage(tool, async () => results());
    page.add(names.map((n) => file(n)));
    await page.start({});
    return page.state().batches[0]!.items.flatMap((i) => i.results.map((r) => r.name));
  };

  it('stay different from names in earlier Batches', async () => {
    const page = createToolPage(tool, async () => [pdf()]);
    page.add([file('report.pdf')]);
    await page.start({});
    page.add([file('report.pdf')]);
    await page.start({});
    const [newest, oldest] = page.state().batches;
    expect(oldest!.items[0]!.results[0]!.name).toBe('report_dtb.pdf');
    expect(newest!.items[0]!.results[0]!.name).toBe('report_dtb_2.pdf');
  });

  it('are never the exact name of a chosen file', async () => {
    expect(await namesFrom(['report_dtb.pdf', 'report.pdf'], () => [pdf()])).toEqual([
      'report_dtb_dtb.pdf',
      'report_dtb_2.pdf',
    ]);
  });
});

describe('all files together', () => {
  const together = defineTool({ ...tool, input: 'together' });
  const names = (page: { state: () => ToolPageState }) => page.state().waiting.map((w) => w.name);

  it('moves a file up or down the waiting list', () => {
    const page = createToolPage(together, async () => []);
    page.add([file('a.pdf'), file('b.pdf'), file('c.pdf')]);
    const [a, , c] = page.state().waiting;
    page.move(c!.id, -1);
    expect(names(page)).toEqual(['a.pdf', 'c.pdf', 'b.pdf']);
    page.move(a!.id, 1);
    expect(names(page)).toEqual(['c.pdf', 'a.pdf', 'b.pdf']);
  });

  it('leaves the first file where it is when moved up, and the last when moved down', () => {
    const page = createToolPage(together, async () => []);
    page.add([file('a.pdf'), file('b.pdf')]);
    const [a, b] = page.state().waiting;
    page.move(a!.id, -1);
    page.move(b!.id, 1);
    expect(names(page)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('runs once over every file in the order set, giving one row named combined_dtb', async () => {
    const ran: string[][] = [];
    const page = createToolPage(together, async (files: File[]) => {
      ran.push(files.map((f) => f.name));
      return [pdf()];
    });
    page.add([file('a.pdf', 100), file('b.pdf', 200)]);
    page.move(page.state().waiting[1]!.id, -1);
    await page.start({});
    expect(ran).toEqual([['b.pdf', 'a.pdf']]);
    const [batch] = page.state().batches;
    expect(batch!.label).toBe('2 files');
    expect(batch!.items).toMatchObject([
      { name: 'b.pdf, a.pdf', size: 300, status: 'done', results: [{ name: 'combined_dtb.pdf' }] },
    ]);
    expect(page.saveAllFiles().map((r) => r.name)).toEqual(['combined_dtb.pdf']);
  });

  it('names a repeat combined_dtb_2, skipping a name a chosen file already has', async () => {
    const page = createToolPage(together, async () => [pdf()]);
    page.add([file('a.pdf')]);
    await page.start({});
    page.add([file('combined_dtb_2.pdf')]);
    await page.start({});
    expect(page.state().batches.map((b) => b.items[0]!.results[0]!.name)).toEqual([
      'combined_dtb_3.pdf',
      'combined_dtb.pdf',
    ]);
  });

  it("shows the Tool's own reason on the one row when it fails", async () => {
    const page = createToolPage(together, async () => {
      throw new ToolFailure('b.pdf has a password.' as Reason);
    });
    page.add([file('a.pdf'), file('b.pdf')]);
    await page.start({});
    expect(page.state().batches[0]!.items).toMatchObject([
      { status: 'failed', reason: 'b.pdf has a password.', results: [] },
    ]);
  });
});

describe('a Tool whose run is marked worker', () => {
  // A MessageChannel stands in for the Web Worker: one end is the page, the other the worker.
  function inWorker(run: ToolRun) {
    const { port1, port2 } = new MessageChannel();
    serveRuns(port2, async () => run as AnyRun);
    return createToolPage({ ...tool, worker: true }, runInWorker(port1, tool.address));
  }

  it('runs each file there, with results named as usual', async () => {
    const page = inWorker(async (f) => [{ blob: new Blob([f.name], { type: 'application/pdf' }) }]);
    page.add([file('a.pdf'), file('b.pdf')]);
    await page.start({});
    const results = page.state().batches[0]!.items.flatMap((item) => item.results);
    expect(results.map((r) => r.name)).toEqual(['a_dtb.pdf', 'b_dtb.pdf']);
    expect(await results[1]!.blob.text()).toBe('b.pdf');
  });

  it("shows the Tool's own reason, and the shared one for any other error", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const page = inWorker(async (f) => {
      if (f.name === 'locked.pdf') throw new ToolFailure('This PDF has a password.' as Reason);
      throw new TypeError('xref table broken');
    });
    page.add([file('locked.pdf'), file('broken.pdf')]);
    await page.start({});
    expect(page.state().batches[0]!.items).toMatchObject([
      { status: 'failed', reason: 'This PDF has a password.' },
      { status: 'failed', reason: 'This file may be damaged or not supported.' },
    ]);
  });

  it('fails the file it was on when the worker stops, and the others carry on', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let stop!: (error: Error) => void;
    const died = new Promise<never>((_, reject) => (stop = reject));
    const { port1, port2 } = new MessageChannel();
    // The first file never finishes, as when the phone runs out of memory.
    serveRuns(port2, async () => (() => new Promise(() => {})) as AnyRun);
    const deadWorker = runInWorker(port1, tool.address, died);
    let calls = 0;
    const page = createToolPage({ ...tool, worker: true }, async (input, options, context) =>
      calls++ === 0 ? deadWorker(input, options, context) : [pdf()],
    );
    page.add([file('a.pdf'), file('b.pdf')]);
    const started = page.start({});
    await vi.waitFor(() => expect(page.state().batches[0]!.items[0]!.status).toBe('working'));
    stop(new Error('The worker stopped'));
    await started;
    expect(page.state().batches[0]!.items).toMatchObject([
      { status: 'failed', reason: 'This file may be damaged or not supported.' },
      { status: 'done' },
    ]);
  });

  it('shows how far along the file in the worker is', async () => {
    const page = inWorker(async (_f, _options, context) => {
      for (const fraction of [0.1, 0.105, 0.29, 0.5]) context!.progress(fraction);
      return [pdf()];
    });
    const seen: (number | undefined)[] = [];
    page.subscribe((state) => state.batches[0] && seen.push(state.batches[0].items[0]!.percent));
    page.add([file('a.pdf')]);
    await page.start({});
    // Progress comes on its own line, so it may arrive just after the result.
    await vi.waitFor(() => expect([...new Set(seen)]).toEqual([undefined, 10, 29, 50]));
  });

  it('shows Getting ready while the worker loads something', async () => {
    let loaded!: () => void;
    const loading = new Promise<void>((resolve) => (loaded = resolve));
    const page = inWorker(async (_f, _options, context) => {
      await context!.gettingReady(loading);
      return [pdf()];
    });
    const seen: boolean[] = [];
    page.subscribe((state) => state.batches[0] && seen.push(state.batches[0].gettingReady));
    page.add([file('a.pdf')]);
    const started = page.start({});
    await vi.waitFor(() => expect(seen).toContain(true));
    loaded();
    await started;
    expect(page.state().batches[0]!.gettingReady).toBe(false);
    expect(page.state().batches[0]!.items[0]!.status).toBe('done');
  });
});

describe('options set per file', () => {
  const trim = defineTool({
    ...tool,
    defaultOptions: { quality: 'high', start: 0, end: null as number | null },
    fileOptions: ['start', 'end'],
  });
  type TrimOptions = typeof trim.defaultOptions;
  const recording = () => {
    const runs: string[] = [];
    const run = async (f: File, options: TrimOptions) => {
      runs.push(`${f.name} ${options.quality} ${options.start}-${options.end}`);
      return [pdf()];
    };
    return { runs, page: createToolPage(trim, run) };
  };

  it("reach run with the page's options, each file keeping its own", async () => {
    const { runs, page } = recording();
    page.add([file('a.mp4'), file('b.mp4')]);
    const [a, b] = page.state().waiting;
    page.setFileOptions(a!.id, { start: 1, end: 2 });
    page.setFileOptions(b!.id, { start: 3, end: 5 });
    await page.start({ quality: 'low', start: 0, end: null });
    expect(runs).toEqual(['a.mp4 low 1-2', 'b.mp4 low 3-5']);
  });

  it("start from the Tool's defaults, shown on the Ready row", () => {
    const { page } = recording();
    page.add([file('a.mp4')]);
    expect(page.state().waiting[0]!.fileOptions).toEqual({ start: 0, end: null });
    page.setFileOptions(page.state().waiting[0]!.id, { end: 4 });
    expect(page.state().waiting[0]!.fileOptions).toEqual({ start: 0, end: 4 });
  });

  it('count as new work only for the file whose values changed', async () => {
    const { runs, page } = recording();
    page.add([file('a.mp4'), file('b.mp4')]);
    const [a] = page.state().waiting;
    await page.start({ quality: 'low', start: 0, end: null });
    expect(page.hasWork({ quality: 'low', start: 0, end: null })).toBe(false);
    page.setFileOptions(a!.id, { start: 2 });
    expect(page.hasWork({ quality: 'low', start: 0, end: null })).toBe(true);
    await page.start({ quality: 'low', start: 0, end: null });
    expect(runs).toEqual(['a.mp4 low 0-null', 'b.mp4 low 0-null', 'a.mp4 low 2-null']);
  });

  it("hold start back while a file's values have a problem", async () => {
    const page = createToolPage(
      defineTool({
        ...trim,
        optionsProblem: ({ start, end }) =>
          end !== null && end <= start ? 'End must be after Start.' : undefined,
      }),
      async () => [pdf()],
    );
    page.add([file('a.mp4'), file('b.mp4')]);
    const [a] = page.state().waiting;
    page.setFileOptions(a!.id, { start: 3, end: 3 });
    const options = { quality: 'low', start: 0, end: null };
    expect(page.hasWork(options)).toBe(false);
    await page.start(options);
    expect(page.state().batches).toEqual([]);
    page.setFileOptions(a!.id, { end: 4 });
    expect(page.hasWork(options)).toBe(true);
  });
});
