import { describe, expect, it, vi } from 'vitest';
import { createToolPage, type ToolPageState } from './batch';
import { defineTool, ToolFailure } from './types';

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
    const page = createToolPage(tool, runFailing(new ToolFailure('This PDF has a password.')));
    page.add([file('bad.pdf'), file('good.pdf')]);
    await page.start({});
    expect(page.state().batches[0]!.items).toMatchObject([
      { name: 'bad.pdf', status: 'failed', reason: 'This PDF has a password.', results: [] },
      { name: 'good.pdf', status: 'done', results: [{ name: 'good_dtb.pdf' }] },
    ]);
  });

  it('shows the shared reason for any other error, with the detail in the console only', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const page = createToolPage(tool, runFailing(new TypeError('xref table broken')));
    page.add([file('bad.pdf'), file('good.pdf')]);
    await page.start({});
    const [bad, good] = page.state().batches[0]!.items;
    expect(bad).toMatchObject({
      status: 'failed',
      reason: 'This file may be damaged or not supported.',
    });
    expect(good!.status).toBe('done');
    expect(String(consoleError.mock.calls.flat())).toContain('xref table broken');
    consoleError.mockRestore();
  });
});

describe('result names', () => {
  const namesFrom = async (names: string[], results: () => ReturnType<typeof pdf>[]) => {
    const page = createToolPage(tool, async () => results());
    page.add(names.map((n) => file(n)));
    await page.start({});
    return page.state().batches[0]!.items.flatMap((i) => i.results.map((r) => r.name));
  };

  it('add _dtb when there is no detail', async () => {
    expect(await namesFrom(['IMG_1234.pdf'], () => [pdf()])).toEqual(['IMG_1234_dtb.pdf']);
  });

  it('take the extension from the result, not the original', async () => {
    const jpg = { blob: new Blob(['x'], { type: 'image/jpeg' }) };
    const page = createToolPage(tool, async () => [jpg]);
    page.add([file('IMG_1234.HEIC')]);
    await page.start({});
    expect(page.state().batches[0]!.items[0]!.results[0]!.name).toBe('IMG_1234_dtb.jpg');
  });

  it('get _2 and _3 when chosen files share a name', async () => {
    expect(
      await namesFrom(['report.pdf', 'report.pdf', 'report.pdf'], () => [pdf('page1')]),
    ).toEqual(['report_dtb_page1.pdf', 'report_dtb_page1_2.pdf', 'report_dtb_page1_3.pdf']);
  });

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

  it('never match a chosen file or each other in any mix of capitals', async () => {
    // Phones and Macs treat Report.PDF and report.pdf as the same file.
    expect(await namesFrom(['Report_dtb.PDF', 'report.pdf'], () => [pdf()])).toEqual([
      'Report_dtb_dtb.pdf',
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
      throw new ToolFailure('b.pdf has a password.');
    });
    page.add([file('a.pdf'), file('b.pdf')]);
    await page.start({});
    expect(page.state().batches[0]!.items).toMatchObject([
      { status: 'failed', reason: 'b.pdf has a password.', results: [] },
    ]);
  });
});
