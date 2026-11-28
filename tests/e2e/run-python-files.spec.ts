// Run Python's Choose and Save (#131): a .py file in and out, the plain reasons, undo, and
// the phone. These tests wait for the editor and the buttons, not for Python, except the
// one that presses Run.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { undoKey } from './editor-keys';
import { tool } from '../../src/tools/run-python/declaration';
import { fillText } from '../../src/text';

const { notes } = tool;
const slow = 120_000;
const samplePath = new URL('./run-python-sample.py', import.meta.url).pathname;
const sampleText = readFileSync(samplePath, 'utf8');

const editorOf = (page: Page) => page.getByLabel(tool.areaLabel, { exact: true });
const programOf = async (page: Page) =>
  (await page.locator('.cm-content .cm-line').allTextContents()).join('\n');
const chooseButton = (page: Page) => page.getByRole('button', { name: notes.choose, exact: true });
const saveButton = (page: Page) => page.getByRole('button', { name: notes.save, exact: true });
const statusOf = (page: Page) => page.getByRole('status').filter({ hasText: /\S/ });

async function open(page: Page) {
  await page.goto('run-python/');
  await expect(editorOf(page)).toBeVisible({ timeout: slow });
}

type Chosen = string | { name: string; mimeType: string; buffer: Buffer };

/**
 * Chooses a file the way a visitor does (press Choose, pick from the device's picker)
 * and waits for the page to say what it did, because reading the file takes a moment.
 */
async function choose(page: Page, file: Chosen, says: string) {
  const picker = page.waitForEvent('filechooser');
  await chooseButton(page).click();
  await (await picker).setFiles(file);
  await expect(statusOf(page)).toHaveText(says);
}

const opened = fillText(notes.chosen, { name: 'run-python-sample.py' });

const jpeg = {
  name: 'photo.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x80]),
};

test('a chosen .py file fills the editor and runs', async ({ page }) => {
  test.setTimeout(slow);
  await open(page);
  expect(await programOf(page)).toBe(notes.starter);

  await choose(page, samplePath, opened);
  expect(await programOf(page)).toBe(sampleText);

  const run = page.getByRole('button', { name: notes.run, exact: true });
  await expect(run).toBeEnabled({ timeout: slow });
  await run.click();
  await expect(page.getByRole('log', { name: notes.consoleLabel })).toContainText(
    'from a file café 42',
  );
});

test('Undo brings the old Program back, and the same file can be chosen twice', async ({
  page,
}) => {
  test.setTimeout(slow);
  await open(page);
  await choose(page, samplePath, opened);
  expect(await programOf(page)).toBe(sampleText);

  await editorOf(page).click();
  await page.keyboard.press(await undoKey(page));
  expect(await programOf(page)).toBe(notes.starter);

  // The same file again still works (its status line is unchanged, so wait on the editor).
  await choose(page, samplePath, opened);
  await expect.poll(() => programOf(page)).toBe(sampleText);
});

test('a file that is not text gets a plain reason and the Program stays', async ({ page }) => {
  test.setTimeout(slow);
  await open(page);

  // Bytes that are not UTF-8.
  await choose(page, jpeg, notes.notAProgram);
  expect(await programOf(page)).toBe(notes.starter);

  // A NUL byte, in what would otherwise be text. First choose a real file, so the reason
  // below is new and the Program it leaves alone is the sample.
  await choose(page, samplePath, opened);
  await expect.poll(() => programOf(page)).toBe(sampleText);
  await choose(
    page,
    { name: 'nul.py', mimeType: 'text/x-python', buffer: Buffer.from('print(1)\u0000') },
    notes.notAProgram,
  );
  expect(await programOf(page)).toBe(sampleText);
});

test('a file that is too big gets a plain reason and the Program stays', async ({ page }) => {
  test.setTimeout(slow);
  await open(page);
  await choose(
    page,
    { name: 'huge.py', mimeType: 'text/x-python', buffer: Buffer.alloc(500_001, 'x') },
    notes.tooBig,
  );
  expect(await programOf(page)).toBe(notes.starter);
});

test('Save keeps the Program as my-program.py when no file was chosen', async ({ page }) => {
  test.setTimeout(slow);
  // Save normally, so the saved file can be checked.
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await open(page);
  const saved = page.waitForEvent('download');
  await saveButton(page).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('my-program.py');
  expect(readFileSync((await download.path())!, 'utf8')).toBe(notes.starter);
});

test('Save is named after the chosen file and holds what is in the editor', async ({ page }) => {
  test.setTimeout(slow);
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await open(page);
  await choose(page, samplePath, opened);
  await expect.poll(() => programOf(page)).toBe(sampleText);
  await editorOf(page).click();
  await page.keyboard.insertText('# changed\n');

  const saved = page.waitForEvent('download');
  await saveButton(page).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('run-python-sample.py');
  const text = readFileSync((await download.path())!, 'utf8');
  expect(text).toBe(await programOf(page));
  expect(text).toContain('# changed');
  expect(text).toContain('from a file');
});

test('on a phone the buttons are 44 px or more and nothing scrolls sideways', async ({ page }) => {
  test.setTimeout(slow);
  await page.setViewportSize({ width: 375, height: 700 });
  await open(page);
  await choose(page, jpeg, notes.notAProgram);
  for (const button of [chooseButton(page), saveButton(page)]) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
