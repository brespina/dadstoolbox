// Run Python's code editor (#130): colour, indent, undo, keyboard exit, phone width. These
// tests wait for the editor, not for Python, except the last, which presses Run.
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { tool } from '../../src/tools/run-python/declaration';

const { notes } = tool;
const slow = 120_000;

const editorOf = (page: Page) => page.getByLabel(tool.areaLabel, { exact: true });
const linesOf = (page: Page) => page.locator('.cm-content .cm-line');
const programOf = async (page: Page) => (await linesOf(page).allTextContents()).join('\n');

/** Opens the page, waits for the editor, and clears it ready for typing. */
async function openEmpty(page: Page) {
  await page.goto('run-python/');
  await expect(editorOf(page)).toBeVisible({ timeout: slow });
  await editorOf(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
}

test('Python words are in colour, with line numbers, and the lock logs nothing', async ({
  page,
}) => {
  test.setTimeout(slow);
  const complaints: string[] = [];
  page.on('console', (message) => {
    if (/content security policy|violates/i.test(message.text())) complaints.push(message.text());
  });
  await page.goto('run-python/');
  await expect(editorOf(page)).toBeVisible({ timeout: slow });
  await expect(page.locator('.cm-lineNumbers')).toContainText('3');

  // The starter Program has a comment, a string and a keyword (`for`).
  const colourOf = (selectorText: string) =>
    linesOf(page)
      .locator('span', { hasText: new RegExp(`^${selectorText}$`) })
      .first()
      .evaluate((element) => getComputedStyle(element).color);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const plain = await linesOf(page)
      .first()
      .evaluate((element) => getComputedStyle(element).color);
    const keyword = await colourOf('for');
    const string = await colourOf('"Python"');
    const comment = await colourOf('# Press Run to see what this prints.');
    expect(new Set([plain, keyword, string, comment]).size, `${scheme}: four colours`).toBe(4);
  }
  expect(complaints).toEqual([]);
});

test('a block indents the next line; Shift+Tab, undo and redo work', async ({ page }) => {
  test.setTimeout(slow);
  await openEmpty(page);
  await page.keyboard.type('for i in range(3):');
  await page.keyboard.press('Enter');
  // Chrome on Android holds Enter back a moment, so wait for the new line before typing.
  await expect(linesOf(page)).toHaveCount(2);
  await page.keyboard.type('print(i)');
  expect(await programOf(page)).toBe('for i in range(3):\n    print(i)');

  // History joins changes made within half a second, so pause to make each step its own undo.
  await page.waitForTimeout(600);
  await page.keyboard.press('Shift+Tab');
  expect(await programOf(page)).toBe('for i in range(3):\nprint(i)');
  await page.waitForTimeout(600);

  await page.keyboard.press('ControlOrMeta+z');
  expect(await programOf(page)).toBe('for i in range(3):\n    print(i)');
  await page.keyboard.press('ControlOrMeta+y');
  expect(await programOf(page)).toBe('for i in range(3):\nprint(i)');
});

test('Tab indents, and Escape then Tab leaves the editor', async ({ page }) => {
  test.setTimeout(slow);
  await openEmpty(page);
  await page.keyboard.type('x');
  await page.keyboard.press('Tab');
  expect(await programOf(page)).toContain('x');
  expect(await programOf(page)).toMatch(/^ +x$|^x\s+$/);
  await expect(editorOf(page)).toBeFocused();

  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(editorOf(page)).not.toBeFocused();
  // The page says so in one plain line, near the editor.
  await expect(page.getByText(notes.leaveEditor, { exact: true })).toBeVisible();
});

test('on a phone there is no sideways scroll, and a long line wraps', async ({ page }) => {
  test.setTimeout(slow);
  await page.setViewportSize({ width: 375, height: 700 });
  await openEmpty(page);
  await page.keyboard.insertText(`print("${'word '.repeat(60)}")`);
  const line = linesOf(page).first();
  const lineHeight = await line.evaluate((element) =>
    parseFloat(getComputedStyle(element).lineHeight),
  );
  expect((await line.boundingBox())!.height).toBeGreaterThan(lineHeight * 2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  // 16 px or more, so iPhone Safari does not zoom in on focus.
  expect(
    await editorOf(page).evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16);
});

test('what is typed in the editor runs', async ({ page }) => {
  test.setTimeout(slow);
  await openEmpty(page);
  await page.keyboard.insertText('print("typed", 6 * 7)');
  const run = page.getByRole('button', { name: notes.run, exact: true });
  await expect(run).toBeEnabled({ timeout: slow });
  await run.click();
  await expect(page.getByRole('log', { name: notes.consoleLabel })).toContainText('typed 42');
});

test("another Tool's page does not load the editor", async ({ page }) => {
  const asked: string[] = [];
  page.context().on('request', (request) => asked.push(request.url()));
  await page.goto('vim-practice/');
  await expect(page.getByLabel('Move the cursor with Vim keys', { exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(asked.filter((url) => /codemirror|ProgramEditor|run-?python/i.test(url))).toEqual([]);
});
