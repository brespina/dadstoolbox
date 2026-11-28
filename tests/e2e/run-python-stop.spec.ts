// Run Python's Stop (#129): ends a Program that never ends, with isolation (an interrupt,
// nothing reloads) and without (the Python worker is ended and a fresh one starts), and
// recovers when Python dies. Python takes 10 to 20 seconds to load, so these wait longer.
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { selectAllKey } from './editor-keys';
import { tool } from '../../src/tools/run-python/declaration';
import { text } from '../../src/text';

const { notes } = tool;
const slow = 120_000;

const runButton = (page: Page) => page.getByRole('button', { name: notes.run, exact: true });
const stopButton = (page: Page) => page.getByRole('button', { name: notes.stop, exact: true });
const consoleOf = (page: Page) => page.getByRole('log', { name: notes.consoleLabel });
const printed = (page: Page) =>
  consoleOf(page).evaluate((element) => (element as HTMLElement).innerText);
const answerField = (page: Page) => page.getByLabel(notes.typeAnswer, { exact: true });

/** Replaces the Program in the editor, with what the editor adds to typing left out. */
async function writeProgram(page: Page, program: string) {
  await page.getByLabel(tool.areaLabel, { exact: true }).click();
  await page.keyboard.press(await selectAllKey(page));
  await page.keyboard.insertText(program);
}

/** Waits for Python to load, writes a Program, and presses Run. */
async function run(page: Page, program: string) {
  await expect(runButton(page)).toBeEnabled({ timeout: slow });
  await writeProgram(page, program);
  await runButton(page).click();
}

const forever = 'print("looping")\nwhile True:\n    pass';

test('Run is greyed and Stop is ready while a Program runs, and both are phone-sized', async ({
  page,
}) => {
  test.setTimeout(slow);
  await page.goto('run-python/');
  // Before there is a Program running, Stop is greyed.
  await expect(stopButton(page)).toBeDisabled();
  await run(page, forever);
  await expect(consoleOf(page)).toContainText('looping');
  // "Running…" shows, Run is greyed, Stop is available.
  const running = page.getByRole('button', { name: notes.running, exact: true });
  await expect(running).toBeDisabled();
  await expect(stopButton(page)).toBeEnabled();
  for (const button of [running, stopButton(page)]) {
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  // The accessibility checks (light and dark) run at the end of the test, with the Program
  // still running.
});

test('Stop ends a Program that never ends, and the next Program runs', async ({ page }) => {
  test.setTimeout(slow);
  await page.goto('run-python/');
  await run(page, forever);
  await expect(consoleOf(page)).toContainText('looping');
  const workerBefore = page.workers();
  expect(workerBefore).toHaveLength(1);
  await stopButton(page).click();
  await expect(consoleOf(page).locator('.note')).toHaveText(notes.stoppedLine);
  // The interrupt ended it: the same Python worker is still there, none was started.
  expect(page.workers()).toEqual(workerBefore);
  // Python's own words for the interrupt are not shown.
  expect(await printed(page)).not.toMatch(/Traceback|KeyboardInterrupt/);
  await expect(consoleOf(page)).not.toContainText(notes.done);
  await expect(stopButton(page)).toBeDisabled();
  await expect(runButton(page)).toBeEnabled();

  // Nothing reloaded: the next Run starts at once.
  await run(page, 'print("second program")');
  await expect(consoleOf(page)).toContainText('second program');
  await expect(consoleOf(page).locator('.note')).toHaveText(notes.done);
  await expect(consoleOf(page)).not.toContainText(notes.stoppedLine);
});

test('Stop ends a Program that waits at input(), and the typing field goes away', async ({
  page,
}) => {
  test.setTimeout(slow);
  await page.goto('run-python/');
  await run(page, 'name = input("Name: ")\nprint("never", name)');
  await expect(answerField(page)).toBeVisible({ timeout: slow });
  await stopButton(page).click();
  await expect(consoleOf(page).locator('.note')).toHaveText(notes.stoppedLine);
  await expect(answerField(page)).toHaveCount(0);
  expect(await printed(page)).not.toMatch(/Traceback|KeyboardInterrupt|never/);
  await expect(runButton(page)).toBeEnabled();
  // And input() works again in the next Run.
  await run(page, 'print("hi", input())');
  await answerField(page).fill('Ada');
  await answerField(page).press('Enter');
  await expect(consoleOf(page)).toContainText('hi Ada');
});

test('a Program that catches the interrupt is ended within about 10 seconds of Stop', async ({
  page,
}) => {
  test.setTimeout(slow);
  await page.goto('run-python/');
  await run(
    page,
    'print("looping")\nwhile True:\n    try:\n        while True:\n            pass\n    except:\n        pass',
  );
  await expect(consoleOf(page)).toContainText('looping');
  const pressed = Date.now();
  await stopButton(page).click();
  await expect(consoleOf(page).locator('.note')).toHaveText(notes.stoppedLine, { timeout: 10_000 });
  expect(Date.now() - pressed).toBeLessThan(10_000);
  // A fresh Python loads meanwhile; Run is there when the visitor wants it.
  await run(page, 'print("after")');
  await expect(consoleOf(page)).toContainText('after');
});

test.describe('without isolation', () => {
  test.use({ serviceWorkers: 'block' });

  test('Stop says Stopped., and a Run pressed at once waits for Python and then runs', async ({
    page,
  }) => {
    test.setTimeout(slow * 2);
    await page.goto('run-python/');
    await expect(page.getByText(notes.noIsolation)).toBeVisible({ timeout: slow });
    await run(page, forever);
    await expect(consoleOf(page)).toContainText('looping');
    await stopButton(page).click();
    await expect(consoleOf(page).locator('.note')).toHaveText(notes.stoppedLine);
    // Variables and the Program are gone with the worker; the editor keeps the text.
    await writeProgram(page, 'print("second program")');
    // Pressed before the fresh Python is ready: it says it is getting ready, then runs.
    await expect(runButton(page)).toBeEnabled();
    await runButton(page).click();
    await expect(
      page.getByRole('button', { name: text.tool.gettingReady, exact: true }),
    ).toBeDisabled();
    await expect(consoleOf(page)).toContainText('second program', { timeout: slow });
    await expect(consoleOf(page).locator('.note')).toHaveText(notes.done);
    await expect(runButton(page)).toBeEnabled();
  });
});

// Not tested here: a worker that dies on its own (the memory line). Python answers
// `[0] * 10**10` with OverflowError and a Program that fills memory with MemoryError, in
// Chromium and in Node alike, so no Program a visitor can write kills the worker on
// demand, and filling four gigabytes of a CI machine would be the only way to try. The
// runner's fake-worker tests (runner.test.ts) cover the page's side: one plain line, the
// worker dropped, a fresh one started, and Run working again.
