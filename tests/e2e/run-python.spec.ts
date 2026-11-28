// Run Python: write a Program, press Run, see what it prints in the Console. Python takes
// 10 to 20 seconds to load (more on a busy machine), so these tests wait longer.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, expectBrowserLock } from './fixtures';
import { tool } from '../../src/tools/run-python/declaration';
import { pyodideFolder } from '../../src/tools/run-python/files';

const { notes } = tool;
const slow = 120_000;

/** Waits for Python to load, types a Program, and presses Run. */
async function run(page: Page, program: string) {
  const runButton = page.getByRole('button', { name: notes.run, exact: true });
  await expect(runButton).toBeEnabled({ timeout: slow });
  await page.getByLabel(tool.areaLabel, { exact: true }).fill(program);
  await runButton.click();
}

const consoleOf = (page: Page) => page.getByRole('log', { name: notes.consoleLabel });
const printed = (page: Page) =>
  consoleOf(page).evaluate((element) => (element as HTMLElement).innerText);

/** The lock a built page carries: the content of its CSP tag. */
function lockOf(file: string) {
  const html = readFileSync(`dist/${file}`, 'utf8');
  const tag = html.match(/<meta\b[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/i)![0];
  return tag
    .match(/\bcontent="([^"]*)"/i)![1]
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
}

test('the first open says it is getting ready, then shows the starter Program', async ({
  page,
}) => {
  test.setTimeout(slow);
  await page.goto('run-python/');
  await expect(page.getByRole('button', { name: 'Getting ready…' })).toBeDisabled();
  await expect(page.getByLabel(tool.areaLabel, { exact: true })).toHaveValue(notes.starter);
  await expect(page.getByRole('button', { name: notes.run, exact: true })).toBeEnabled({
    timeout: slow,
  });
  // Python runs in a worker made from a blob address, so it inherits the browser lock.
  expect(page.workers().map((worker) => worker.url().split(':')[0])).toContain('blob');
});

test('run the starter Program and see its output, in order', async ({ page }) => {
  test.setTimeout(slow);
  await page.goto('run-python/');
  const runButton = page.getByRole('button', { name: notes.run, exact: true });
  await expect(runButton).toBeEnabled({ timeout: slow });
  await runButton.click();
  await expect(consoleOf(page)).toContainText('Counting: 3');
  expect((await printed(page)).trim()).toBe(
    'Hello from Python\nCounting: 1\nCounting: 2\nCounting: 3',
  );
  await expect(runButton).toBeEnabled();
});

test('type a Program, run it, and run it again with a fresh start', async ({ page }) => {
  test.setTimeout(slow);
  await page.goto('run-python/');
  await run(page, 'x = 41\nprint("first", x + 1)');
  await expect(consoleOf(page)).toContainText('first 42');

  // The Console is cleared and a variable from the last Run is gone.
  await run(page, 'try:\n    print(x)\nexcept NameError:\n    print("second: x is gone")');
  await expect(consoleOf(page)).toContainText('second: x is gone');
  await expect(consoleOf(page)).not.toContainText('first 42');
});

test('a partial line stays on its line, and an error is marked as one', async ({ page }) => {
  test.setTimeout(slow);
  await page.goto('run-python/');
  await run(page, 'print("a", end="")\nprint("b")\nprint(1 / 0)');
  await expect(consoleOf(page)).toContainText('ZeroDivisionError');
  const lines = (await printed(page)).split('\n');
  expect(lines[0]).toBe('ab');
  // More than colour: the words "Error:" for a screen reader and a bar beside the lines.
  expect(await consoleOf(page).locator('.error').first().innerText()).toContain('ZeroDivision');
  await expect(consoleOf(page).locator('.error .visually-hidden').first()).toHaveText(
    notes.errorMark,
  );
});

test('20,000 lines leave the page responsive and the Console holds the last 5,000', async ({
  page,
}) => {
  test.setTimeout(slow);
  await page.goto('run-python/');
  await run(page, 'for i in range(20000):\n    print("line", i)');
  await expect(consoleOf(page)).toContainText('line 19999', { timeout: 60_000 });
  // The note is a paragraph, so a blank line follows it in the page's text.
  const lines = (await printed(page)).split('\n').filter((line) => line !== '');
  // One note, then 5,000 lines.
  expect(lines[0]).toBe(notes.linesRemoved);
  expect(lines.slice(1)).toHaveLength(5000);
  expect(lines[1]).toBe('line 15000');
  expect(lines.filter((line) => line === notes.linesRemoved)).toHaveLength(1);
  // The page still answers: Run is ready again and the editor takes typing.
  await expect(page.getByRole('button', { name: notes.run, exact: true })).toBeEnabled();
  await page.getByLabel(tool.areaLabel, { exact: true }).fill('print("still here")');
  await expect(page.getByLabel(tool.areaLabel, { exact: true })).toHaveValue('print("still here")');
});

test('only this page has the lock that lets Python start', async ({ page }) => {
  const scriptSrc = (csp: string) => csp.match(/(?:^|;)\s*script-src ([^;]*)/)?.[1];
  const own = lockOf('run-python/index.html');
  expect(scriptSrc(own)).toContain("'wasm-unsafe-eval'");
  // One script-src, with Astro's own sources in it: a second directive would be ignored.
  expect(own.match(/script-src/g)).toHaveLength(1);
  expect(scriptSrc(own)).toContain("'self'");
  expectBrowserLock(own, 'run-python');
  for (const file of ['index.html', 'vim-practice/index.html', 'typing-test/index.html']) {
    expect(lockOf(file), file).not.toContain('wasm-unsafe-eval');
  }
  // The page the browser got says the same as the file (after the first visit's reload).
  await page.goto('run-python/');
  await expect(page.getByLabel(tool.areaLabel, { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(
    await page.locator('meta[http-equiv="content-security-policy" i]').getAttribute('content'),
  ).toContain("'wasm-unsafe-eval'");
});

test("another Tool's page does not load Python", async ({ page }) => {
  const asked: string[] = [];
  page.context().on('request', (request) => asked.push(request.url()));
  await page.goto('vim-practice/');
  await expect(page.getByLabel('Move the cursor with Vim keys', { exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(asked.filter((url) => /pyodide|python/i.test(url))).toEqual([]);
});

test("Python's files are served with the types the browser needs", async ({ page }) => {
  await page.goto('run-python/');
  const types = { 'pyodide.asm.wasm': 'application/wasm', 'pyodide.mjs': 'text/javascript' };
  for (const [name, type] of Object.entries(types)) {
    const response = await page.request.get(`${pyodideFolder}/${name}`);
    expect(response.ok(), name).toBe(true);
    expect(response.headers()['content-type'], name).toContain(type);
  }
});

// Isolation (ADR-0009): a service worker scoped to this page's folder adds the headers
// that make the page cross-origin isolated. Each test has a fresh context, so a first visit.

/** Counts the main frame's loads, so a test can check the page reloaded only once. */
function countLoads(page: Page) {
  const loads = { count: 0 };
  page.on('load', () => loads.count++);
  return loads;
}

test('the first visit reloads once and the page is isolated, and Python still runs', async ({
  page,
}) => {
  test.setTimeout(slow);
  const loads = countLoads(page);
  await page.goto('run-python/');
  await run(page, 'print(6 * 7)');
  await expect.poll(() => printed(page), { timeout: slow }).toContain('42');
  expect(loads.count).toBe(2);
  expect(
    await page.evaluate(() => crossOriginIsolated && typeof SharedArrayBuffer === 'function'),
  ).toBe(true);
  await expect(page.getByText(notes.noIsolation)).toHaveCount(0);
  const scopes = await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).map((registration) => registration.scope),
  );
  expect(scopes).toEqual([new URL('./', page.url()).href]);
  expect(scopes[0]).toMatch(/\/run-python\/$/);
});

test('other pages are not touched by the service worker', async ({ page }) => {
  test.setTimeout(slow);
  await page.goto('run-python/');
  await expect(page.getByLabel(tool.areaLabel, { exact: true })).toBeVisible({ timeout: slow });
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  for (const address of ['./', 'vim-practice/']) {
    await page.goto(address);
    expect(
      await page.evaluate(() => ({
        controlled: navigator.serviceWorker.controller !== null,
        isolated: crossOriginIsolated,
      })),
      address,
    ).toEqual({ controlled: false, isolated: false });
  }
});

test.describe('with service workers blocked', () => {
  test.use({ serviceWorkers: 'block' });

  test('the page says what it cannot do, does not reload, and Run still works', async ({
    page,
  }) => {
    test.setTimeout(slow);
    const loads = countLoads(page);
    await page.goto('run-python/');
    await expect(page.getByText(notes.noIsolation)).toBeVisible({ timeout: slow });
    await run(page, 'print("still here")');
    await expect.poll(() => printed(page), { timeout: slow }).toContain('still here');
    expect(loads.count).toBe(1);
  });
});
