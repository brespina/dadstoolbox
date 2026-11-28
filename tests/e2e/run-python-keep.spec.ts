// Run Python's Keep (#132, ADR-0011): nothing is stored unless the visitor chooses, and
// what is kept comes back in the editor, never run. These tests wait for the editor, not
// for Python. The fixtures' lock check (no request leaves the Site) runs on each of them;
// the first Keep test also looks for the kept text in any request.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { selectAllKey } from './editor-keys';
import { tool } from '../../src/tools/run-python/declaration';
import { fillText } from '../../src/text';

const { notes } = tool;
const slow = 120_000;
const samplePath = new URL('./run-python-sample.py', import.meta.url).pathname;
const sampleText = readFileSync(samplePath, 'utf8');

const editorOf = (page: Page) => page.getByLabel(tool.areaLabel, { exact: true });
const programOf = async (page: Page) =>
  (await page.locator('.cm-content .cm-line').allTextContents()).join('\n');
const neverKeep = (page: Page) => page.getByRole('radio', { name: notes.neverKeep, exact: true });
const keepProgram = (page: Page) =>
  page.getByRole('radio', { name: notes.keepProgram, exact: true });
const stored = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));

async function open(page: Page) {
  await page.goto('run-python/');
  await expect(editorOf(page)).toBeVisible({ timeout: slow });
}

/** Replaces the starter Program with `text`, the way the editor tests do. */
async function typeProgram(page: Page, text: string) {
  await editorOf(page).click();
  await page.keyboard.press(await selectAllKey(page));
  await page.keyboard.insertText(text);
  await expect.poll(() => programOf(page)).toBe(text);
}

test('on a fresh visit nothing is stored and typing is gone after a reload', async ({ page }) => {
  test.setTimeout(slow);
  await open(page);
  expect(await stored(page)).toEqual({});
  await expect(neverKeep(page)).toBeChecked();
  await expect(page.getByText(notes.neverKeepWords)).toBeVisible();

  await typeProgram(page, 'print("typed, not kept")');
  // Longer than the delay Keep waits after typing, so a stray write would show.
  await page.waitForTimeout(1_000);
  expect(await stored(page)).toEqual({});

  await page.reload();
  await expect(editorOf(page)).toBeVisible({ timeout: slow });
  expect(await programOf(page)).toBe(notes.starter);
  expect(await stored(page)).toEqual({});
});

test('Keep brings the typed Program back, and Never keep empties storage at once', async ({
  page,
}) => {
  test.setTimeout(slow);
  const secret = 'print("kept: 7f3a9c")';
  const sent: string[] = [];
  page.on('request', (request) => sent.push(request.url() + (request.postData() ?? '')));

  await open(page);
  await keepProgram(page).check();
  await expect(page.getByText(notes.keepWords)).toBeVisible();
  // Choosing Keep stores the choice and the Program on the spot.
  expect(Object.keys(await stored(page)).sort()).toEqual([
    'dadstoolbox:run-python:keep',
    'dadstoolbox:run-python:program',
  ]);

  await typeProgram(page, secret);
  await expect
    .poll(async () => (await stored(page))['dadstoolbox:run-python:program'])
    .toBe(secret);

  await page.reload();
  await expect(editorOf(page)).toBeVisible({ timeout: slow });
  expect(await programOf(page)).toBe(secret);
  await expect(keepProgram(page)).toBeChecked();
  await expect(page.getByText(notes.keepWords)).toBeVisible();
  // It is put in the editor, never run: nothing is in the Console.
  await expect(page.getByText(notes.consoleEmpty)).toBeVisible();

  await neverKeep(page).check();
  expect(await stored(page)).toEqual({});
  await expect(page.getByText(notes.neverKeepWords)).toBeVisible();
  // A write that was waiting does not bring it back.
  await page.waitForTimeout(1_000);
  expect(await stored(page)).toEqual({});

  await page.reload();
  await expect(editorOf(page)).toBeVisible({ timeout: slow });
  expect(await programOf(page)).toBe(notes.starter);
  await expect(neverKeep(page)).toBeChecked();

  expect(sent.filter((request) => request.includes('7f3a9c'))).toEqual([]);
});

test('a chosen .py file is an edit like any other and is kept', async ({ page }) => {
  test.setTimeout(slow);
  await open(page);
  await keepProgram(page).check();

  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: notes.choose, exact: true }).click();
  await (await picker).setFiles(samplePath);
  await expect(page.getByRole('status').filter({ hasText: /\S/ })).toHaveText(
    fillText(notes.chosen, { name: 'run-python-sample.py' }),
  );
  await expect
    .poll(async () => (await stored(page))['dadstoolbox:run-python:program'])
    .toBe(sampleText);

  await page.reload();
  await expect(editorOf(page)).toBeVisible({ timeout: slow });
  expect(await programOf(page)).toBe(sampleText);
});

test('a stored value that is not a Program is ignored and removed', async ({ page }) => {
  test.setTimeout(slow);
  await open(page);
  // Another project on the Site's address could have left these.
  await page.evaluate(() => {
    localStorage.setItem('dadstoolbox:run-python:keep', 'yes');
    localStorage.setItem('dadstoolbox:run-python:program', 'print("not mine")');
    localStorage.setItem('other-project', 'untouched');
  });
  await page.reload();
  await expect(editorOf(page)).toBeVisible({ timeout: slow });
  expect(await programOf(page)).toBe(notes.starter);
  await expect(neverKeep(page)).toBeChecked();
  expect(await stored(page)).toEqual({ 'other-project': 'untouched' });
});

test('storage that refuses shows the plain line and Never keep', async ({ page }) => {
  test.setTimeout(slow);
  // Like a private window or blocked site data: opening localStorage throws.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  await open(page);
  // Nothing is said until the visitor asks to keep something.
  await expect(page.getByText(notes.cannotKeep)).toHaveCount(0);
  await keepProgram(page).check();
  await expect(page.getByText(notes.cannotKeep)).toBeVisible();
  await expect(neverKeep(page)).toBeChecked();
  await expect(keepProgram(page)).not.toBeChecked();
  await expect(page.getByText(notes.neverKeepWords)).toBeVisible();
});

test('storage that is full shows the plain line and Never keep', async ({ page }) => {
  test.setTimeout(slow);
  await page.addInitScript(() => {
    Storage.prototype.setItem = function (this: Storage, key: string) {
      if (this === window.localStorage) throw new DOMException(key, 'QuotaExceededError');
    };
  });
  await open(page);
  await keepProgram(page).check();
  await expect(page.getByText(notes.cannotKeep)).toBeVisible();
  await expect(neverKeep(page)).toBeChecked();
  expect(await stored(page)).toEqual({});
});

test('on a phone the choice is 44 px or more and nothing scrolls sideways', async ({ page }) => {
  test.setTimeout(slow);
  await page.setViewportSize({ width: 375, height: 700 });
  await open(page);
  await keepProgram(page).check();
  for (const radio of [neverKeep(page), keepProgram(page)]) {
    const box = (await radio.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
