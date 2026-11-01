import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTypedToolPage } from './typed';
import { defineTool, ToolFailure, type Reason, type ToolTextRun } from './types';

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
        if (typed === 'long') throw new ToolFailure('Too long.' as Reason);
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

  it('makes the result again with the typed text when the options change', async () => {
    const run = vi.fn<ToolTextRun<{ colour: string }>>(async (typed, { colour }) => [
      png(`${typed}|${colour}`),
    ]);
    const page = createTypedToolPage({ ...tool, defaultOptions: { colour: 'black' } }, run, 150);
    page.change({ colour: 'black' });
    await vi.advanceTimersByTimeAsync(150);
    expect(run).not.toHaveBeenCalled();
    page.type('hello', { colour: 'black' });
    await vi.advanceTimersByTimeAsync(150);
    page.change({ colour: 'red' });
    expect(page.state().updating).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    expect(await page.state().result?.blob.text()).toBe('hello|red');
  });

  it('passes a file held in the options to run, and makes the result again when it changes', async () => {
    type Options = { logo: File | null };
    const run: ToolTextRun<Options> = async (typed, { logo }) => [
      png(`${typed}|${logo ? await logo.text() : 'no logo'}`),
    ];
    const page = createTypedToolPage<Options>({ ...tool, defaultOptions: { logo: null } }, run);
    page.type('hello', { logo: null });
    await vi.advanceTimersByTimeAsync(150);
    page.change({ logo: new File(['cat'], 'cat.png', { type: 'image/png' }) });
    await vi.advanceTimersByTimeAsync(150);
    expect(await page.state().result?.blob.text()).toBe('hello|cat');
    page.change({ logo: null });
    await vi.advanceTimersByTimeAsync(150);
    expect(await page.state().result?.blob.text()).toBe('hello|no logo');
  });

  it("carries the result's warnings, or none", async () => {
    const page = createTypedToolPage(
      tool,
      async (typed) => [
        typed === 'pale'
          ? { ...png(typed), warnings: ['These colours may not scan.'] }
          : png(typed),
      ],
      150,
    );
    page.type('pale', {});
    await vi.advanceTimersByTimeAsync(150);
    expect(page.state().result?.warnings).toEqual(['These colours may not scan.']);
    page.type('plain', {});
    await vi.advanceTimersByTimeAsync(150);
    expect(page.state().result?.warnings).toEqual([]);
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

describe('describing the picture', () => {
  it('says what was typed, by default', async () => {
    const page = createTypedToolPage(tool, echo, 150);
    page.type('hello', {});
    await vi.advanceTimersByTimeAsync(150);
    expect(page.state().result?.label).toBe('code that says: hello');
  });
});

describe('a Tool with no type box', () => {
  const network = defineTool({
    ...tool,
    address: 'fake-network',
    typeBox: false,
    textFor: (options: { name: string }) => ({ pictureLabel: `Code for ${options.name}` }),
    defaultOptions: { name: '' },
  });
  const byName: ToolTextRun<{ name: string }> = async (typed, { name }) =>
    name === '' ? [] : [png(`${typed}|${name}`)];

  it('makes the result again once the options stop changing, with no typed text', async () => {
    const run = vi.fn(byName);
    const page = createTypedToolPage(network, run, 150);
    for (const name of ['H', 'Ho', 'Home']) {
      page.change({ name });
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(page.state().updating).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    expect(run.mock.calls).toEqual([['', { name: 'Home' }]]);
    const { result } = page.state();
    expect(await result?.blob.text()).toBe('|Home');
    expect(result?.name).toBe('fake-network_dtb.png');
  });

  it('describes the picture from the options it was made with', async () => {
    const page = createTypedToolPage(network, byName, 150);
    page.change({ name: 'Home' });
    await vi.advanceTimersByTimeAsync(150);
    expect(page.state().result?.label).toBe('Code for Home');
  });

  it('shows nothing, and no reason, when run makes nothing', async () => {
    const page = createTypedToolPage(network, byName, 150);
    page.change({ name: 'Home' });
    await vi.advanceTimersByTimeAsync(150);
    page.change({ name: '' });
    await vi.advanceTimersByTimeAsync(150);
    expect(page.state()).toEqual({ result: null, reason: null, updating: false });
  });
});
