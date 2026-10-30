import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTypedToolPage } from './typed';
import { defineTool, ToolFailure, type ToolTextRun } from './types';

const tool = defineTool({
  address: 'fake-code',
  name: 'Make a fake code',
  blurb: 'For tests.',
  category: 'Other',
  position: 1,
  noun: { one: 'code', many: 'codes' },
  accept: [],
  input: 'none',
  needs: [],
  largeFileLimit: 0,
  startButton: 'Make it',
  worker: false,
  outsideAddresses: [],
  defaultOptions: {},
});

const png = (typed: string) => ({ blob: new Blob([typed], { type: 'image/png' }) });
const echo: ToolTextRun = async (typed) => [png(typed)];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('typing', () => {
  it('makes a result once typing pauses, named after the Tool', async () => {
    const page = createTypedToolPage(tool, echo, 150);
    page.type('hello', {});
    expect(page.state()).toMatchObject({ result: null, updating: true });
    await vi.advanceTimersByTimeAsync(150);
    const { result, updating, reason } = page.state();
    expect(updating).toBe(false);
    expect(reason).toBeNull();
    expect(result?.name).toBe('fake-code_dtb.png');
    expect(await result?.blob.text()).toBe('hello');
  });

  it('runs only once for a burst of typing, with the last text', async () => {
    const run = vi.fn(echo);
    const page = createTypedToolPage(tool, run, 150);
    for (const typed of ['h', 'he', 'hel', 'hell', 'hello']) {
      page.type(typed, {});
      await vi.advanceTimersByTimeAsync(50);
    }
    await vi.advanceTimersByTimeAsync(150);
    expect(run.mock.calls.map(([typed]) => typed)).toEqual(['hello']);
  });

  it('never lets a slow earlier result replace a newer one', async () => {
    const slowFirst: ToolTextRun = async (typed) => {
      await new Promise((resolve) => setTimeout(resolve, typed === 'old' ? 1000 : 10));
      return [png(typed)];
    };
    const page = createTypedToolPage(tool, slowFirst, 150);
    page.type('old', {});
    await vi.advanceTimersByTimeAsync(200);
    page.type('new', {});
    await vi.advanceTimersByTimeAsync(2000);
    expect(await page.state().result?.blob.text()).toBe('new');
  });

  it('shows nothing, and no reason, when the box is emptied', async () => {
    const run = vi.fn(echo);
    const page = createTypedToolPage(tool, run, 150);
    page.type('hello', {});
    await vi.advanceTimersByTimeAsync(150);
    page.type('   ', {});
    expect(page.state()).toEqual({ result: null, reason: null, updating: false });
    await vi.advanceTimersByTimeAsync(150);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("shows the Tool's own reason, or the shared one", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const page = createTypedToolPage(
      tool,
      async (typed) => {
        if (typed === 'long') throw new ToolFailure('Too long.');
        throw new Error('broken');
      },
      150,
    );
    page.type('long', {});
    await vi.advanceTimersByTimeAsync(150);
    expect(page.state()).toEqual({ result: null, reason: 'Too long.', updating: false });
    page.type('other', {});
    await vi.advanceTimersByTimeAsync(150);
    expect(page.state().reason).toBe("That didn't work. Try changing what you typed.");
  });

  it('tells listeners about each change', async () => {
    const page = createTypedToolPage(tool, echo, 150);
    const seen: boolean[] = [];
    page.subscribe((state) => seen.push(state.updating));
    page.type('hi', {});
    await vi.advanceTimersByTimeAsync(150);
    expect(seen.at(0)).toBe(true);
    expect(seen.at(-1)).toBe(false);
  });
});
