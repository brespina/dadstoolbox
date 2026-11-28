// Sign a PDF end to end, in a real browser: the Signature pad, the page viewer loading
// only here, placing and removing a Mark, start held back until there is something to
// sign, the password reason in place of the pages, and the saved PDF.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { degrees, PDFDocument, StandardFonts } from 'pdf-lib';
import { test, expect } from './fixtures';
import { tool } from '../../src/tools/sign-pdf/declaration';
import { picturesOn } from '../../src/tools/sign-pdf/pictures-on';

const samples = fileURLToPath(new URL('../../src/tools/sign-pdf/', import.meta.url));
// Three pages, each 300 × 200 points.
const sample = `${samples}sample.pdf`;
const locked = `${samples}sample-password.pdf`;
const signed = `${samples}sample-signed.pdf`;
const emptyField = `${samples}sample-signature-field.pdf`;
const notes = tool.notes as Record<string, string>;

/** The page viewer's files: pdf.js's own code and its worker. */
const isViewer = (url: string) => /\/_astro\/(viewer|pdf\.worker)[.-]|\/pdfjs\//.test(url);
/** pdf.js's version, which its code holds as text whatever file it is bundled into. */
const pdfjsVersion = (
  JSON.parse(
    readFileSync(new URL('../../node_modules/pdfjs-dist/package.json', import.meta.url), 'utf8'),
  ) as { version: string }
).version;

async function choose(page: Page, files: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?PDFs/).click();
  await (await chooser).setFiles(files);
}

/** Whether the pad shows any ink. */
const padHasInk = (page: Page) =>
  page.getByRole('img', { name: notes.padLabel }).evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    return data.some((value, i) => i % 4 === 3 && value > 0);
  });

/** Draws a line through these points on the pad (fractions of it) with the mouse. */
async function drawOnPad(page: Page, points: readonly (readonly [number, number])[]) {
  const pad = page.getByRole('img', { name: notes.padLabel });
  await pad.scrollIntoViewIfNeeded();
  // A line drawn before the page has woken up leaves no ink, so draw until it shows.
  await expect(async () => {
    const box = (await pad.boundingBox())!;
    const at = ([x, y]: readonly [number, number]) =>
      [box.x + box.width * x, box.y + box.height * y] as const;
    await page.mouse.move(...at(points[0]!));
    await page.mouse.down();
    for (const point of points.slice(1)) await page.mouse.move(...at(point), { steps: 4 });
    await page.mouse.up();
    expect(await padHasInk(page)).toBe(true);
  }).toPass({ timeout: 10_000 });
}

/** Draws a zigzag across the pad with the mouse. */
const drawSignature = (page: Page) =>
  drawOnPad(page, [
    [0.1, 0.6],
    [0.3, 0.3],
    [0.5, 0.7],
    [0.7, 0.3],
    [0.9, 0.6],
  ]);

const pageOne = (page: Page) => page.getByRole('group', { name: 'Page 1 of sample.pdf' });

/** Waits for the page viewer to show the pages, then taps page 1 at fractions of it. */
async function tapPageOne(page: Page, x: number, y: number) {
  await expect(pageOne(page)).toBeVisible();
  const box = (await pageOne(page).boundingBox())!;
  await pageOne(page).click({ position: { x: box.width * x, y: box.height * y } });
}

const start = (page: Page) => page.getByRole('button', { name: tool.startButton });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
    // Any break of the browser lock, such as a font or worker it blocks.
    (window as unknown as { blocked: string[] }).blocked = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      (window as unknown as { blocked: string[] }).blocked.push(event.violatedDirective),
    );
  });
});

test('draw, choose sample.pdf, tap page 1, and the saved PDF has the Signature there', async ({
  page,
}) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await tapPageOne(page, 0.5, 0.5);
  await expect(
    page.getByRole('button', { name: 'Signature on page 1', exact: true }),
  ).toBeVisible();

  await start(page).click();
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save sample_dtb_signed.pdf' }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('sample_dtb_signed.pdf');

  const signed = await PDFDocument.load(await readFile((await download.path())!));
  expect(signed.getPageCount()).toBe(3);
  expect(picturesOn(signed.getPage(1))).toEqual([]);
  const [picture, ...more] = picturesOn(signed.getPage(0));
  expect(more).toEqual([]);
  // A third of the page wide, centred where it was tapped, and wider than it is high.
  // Within 2 points: a tap lands on whole CSS pixels.
  const within = (value: number, expected: number) =>
    expect(Math.abs(value - expected)).toBeLessThan(2);
  within(picture!.width, 100);
  within(picture!.x + picture!.width / 2, 150);
  within(picture!.y + picture!.height / 2, 100);
  expect(picture!.height).toBeLessThan(picture!.width);
  expect(picture!.turn).toBe(0);

  expect(await page.evaluate(() => (window as unknown as { blocked: string[] }).blocked)).toEqual(
    [],
  );
});

test('start waits for a Mark and a Signature, with the words for each', async ({ page }) => {
  await page.goto('sign-pdf/');
  await choose(page, [sample]);
  await expect(page.getByText(tool.notes.nothingPlaced!, { exact: true })).toBeVisible();
  await expect(start(page)).toBeDisabled();

  // A Mark placed before a Signature is drawn.
  await tapPageOne(page, 0.5, 0.5);
  await expect(page.getByText(tool.notes.noSignature!, { exact: true })).toBeVisible();
  await expect(start(page)).toBeDisabled();

  await drawSignature(page);
  await expect(page.getByText(tool.notes.noSignature!, { exact: true })).toBeHidden();
  await expect(start(page)).toBeEnabled();

  // Clear empties the pad, so start waits again.
  await page.getByRole('button', { name: notes.clear }).click();
  await expect(page.getByText(tool.notes.noSignature!, { exact: true })).toBeVisible();
  await expect(start(page)).toBeDisabled();
});

/** A page's Signature Mark, by its label. */
const markOn = (page: Page, number: number) =>
  page.getByRole('button', { name: `Signature on page ${number}`, exact: true });

const addTo = (page: Page, number: number) =>
  page.getByRole('button', { name: `Add to page ${number}`, exact: true });

/** Where a Mark sits on page 1, as fractions of the page as shown. */
async function placeOnPageOne(page: Page, mark: ReturnType<typeof markOn>) {
  const sheet = (await pageOne(page).boundingBox())!;
  const box = (await mark.boundingBox())!;
  return {
    x: (box.x - sheet.x) / sheet.width,
    y: (box.y - sheet.y) / sheet.height,
    width: box.width / sheet.width,
    height: box.height / sheet.height,
  };
}

/** Starts, saves and opens the PDF, to read where its pictures landed. */
async function savedPdf(page: Page) {
  await start(page).click();
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save sample_dtb_signed.pdf' }).click();
  return PDFDocument.load(await readFile((await (await saved).path())!));
}

/** Checks that a saved picture is where the page showed the Mark (sample.pdf is 300 × 200). */
function expectSavedAt(
  picture: ReturnType<typeof picturesOn>[number],
  shown: { x: number; y: number; width: number; height: number },
) {
  // Within 2 points: the page is shown at whole CSS pixels.
  const near = (value: number, expected: number) =>
    expect(Math.abs(value - expected)).toBeLessThan(2);
  near(picture.x, shown.x * 300);
  near(picture.width, shown.width * 300);
  near(picture.y + picture.height, 200 - shown.y * 200);
}

test('a Mark placed before a tall Signature is drawn is fitted back inside its page', async ({
  page,
}) => {
  await page.goto('sign-pdf/');
  await choose(page, [sample]);
  // Placed near the bottom with the pad's shape, three times as wide as it is high.
  await tapPageOne(page, 0.5, 0.9);
  const mark = markOn(page, 1);
  await expect(mark).toBeVisible();

  // A nearly upright line: at a third of the page wide it would be taller than the page.
  await drawOnPad(page, [
    [0.5, 0.1],
    [0.52, 0.5],
    [0.55, 0.9],
  ]);
  await expect(mark.locator('img')).toHaveCount(1);
  await expect
    .poll(async () => {
      const place = await placeOnPageOne(page, mark);
      return place.y >= -0.001 && place.y + place.height <= 1.001 && place.width < 1 / 3;
    })
    .toBe(true);
  const shown = await placeOnPageOne(page, mark);

  const [picture, ...more] = picturesOn((await savedPdf(page)).getPage(0));
  expect(more).toEqual([]);
  expectSavedAt(picture!, shown);
  expect(picture!.y).toBeGreaterThan(-2);
  expect(picture!.height).toBeGreaterThan(picture!.width);
});

test('Remove takes a Mark away', async ({ page }) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await tapPageOne(page, 0.3, 0.3);
  // A new Mark is chosen, so its buttons show.
  const mark = markOn(page, 1);
  await expect(mark).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Remove: Signature on page 1', exact: true }).click();
  await expect(mark).toHaveCount(0);
  await expect(page.getByText(tool.notes.nothingPlaced!, { exact: true })).toBeVisible();
  await expect(start(page)).toBeDisabled();
});

test('the keyboard places, moves, resizes and removes a Mark', async ({ page }) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();

  // Add, with its kind chosen above the pages.
  await expect(page.getByRole('radio', { name: 'Signature', exact: true })).toBeChecked();
  await addTo(page, 1).click();
  const mark = markOn(page, 1);
  await expect(mark).toBeFocused();
  await expect(mark).toHaveAttribute('aria-label', 'Signature on page 1');
  const first = await placeOnPageOne(page, mark);
  // The lower middle of the page, a third wide.
  expect(first.x + first.width / 2).toBeCloseTo(0.5, 1);
  expect(first.y + first.height / 2).toBeCloseTo(0.8, 1);
  expect(first.width).toBeCloseTo(1 / 3, 1);

  // Three steps right, 1% of the page each.
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  const right = await placeOnPageOne(page, mark);
  expect(right.x - first.x).toBeCloseTo(0.03, 2);
  expect(right.y).toBeCloseTo(first.y, 3);
  // Shift: 10% up.
  await page.keyboard.press('Shift+ArrowUp');
  const up = await placeOnPageOne(page, mark);
  expect(first.y - up.y).toBeCloseTo(0.1, 2);
  // Plus: a tenth bigger, about its centre.
  await page.keyboard.press('+');
  const bigger = await placeOnPageOne(page, mark);
  expect(bigger.width / up.width).toBeCloseTo(1.1, 1);
  expect(bigger.x + bigger.width / 2).toBeCloseTo(up.x + up.width / 2, 2);
  // The keys didn't scroll the page sideways.
  expect(await page.evaluate(() => window.scrollX)).toBe(0);

  // The saved PDF has it where the page showed it.
  const signed = await savedPdf(page);
  const [picture, ...more] = picturesOn(signed.getPage(0));
  expect(more).toEqual([]);
  expectSavedAt(picture!, bigger);
});

test('Delete and Backspace remove a Mark, and focus goes to its page', async ({ page }) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();
  await addTo(page, 1).click();
  const mark = markOn(page, 1);
  await expect(mark).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(mark).toHaveCount(0);
  await expect(addTo(page, 1)).toBeFocused();

  // Marks stack: any number to a page and a PDF.
  await addTo(page, 1).click();
  await addTo(page, 1).click();
  await expect(markOn(page, 1)).toHaveCount(2);
  await addTo(page, 3).click();
  await expect(markOn(page, 3)).toBeFocused();
  await page.keyboard.press('Backspace');
  await expect(markOn(page, 3)).toHaveCount(0);
  await expect(addTo(page, 3)).toBeFocused();
  await expect(markOn(page, 1)).toHaveCount(2);
});

test('removing a middle Mark leaves the others where they were, and keys go to the right one', async ({
  page,
}) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();
  const marks = markOn(page, 1);
  // Three Marks on one page, each moved somewhere of its own (each Add focuses the new one).
  await addTo(page, 1).click();
  await page.keyboard.press('Shift+ArrowLeft');
  await addTo(page, 1).click();
  await page.keyboard.press('Shift+ArrowUp');
  await addTo(page, 1).click();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(marks).toHaveCount(3);
  const first = await placeOnPageOne(page, marks.nth(0));
  const last = await placeOnPageOne(page, marks.nth(2));
  expect(first.x).not.toBeCloseTo(last.x, 2);

  // Take the middle one away with its key: focus goes to the page's Add button.
  await marks.nth(1).focus();
  await page.keyboard.press('Delete');
  await expect(marks).toHaveCount(2);
  await expect(addTo(page, 1)).toBeFocused();
  const after = [
    await placeOnPageOne(page, marks.nth(0)),
    await placeOnPageOne(page, marks.nth(1)),
  ];
  expect(after[0]!.x).toBeCloseTo(first.x, 3);
  expect(after[0]!.y).toBeCloseTo(first.y, 3);
  expect(after[1]!.x).toBeCloseTo(last.x, 3);
  expect(after[1]!.y).toBeCloseTo(last.y, 3);

  // The key goes to the Mark that has focus, and only to it. Only it is chosen.
  await marks.nth(1).focus();
  await page.keyboard.press('ArrowDown');
  const moved = await placeOnPageOne(page, marks.nth(1));
  expect(moved.y - last.y).toBeCloseTo(0.01, 2);
  expect((await placeOnPageOne(page, marks.nth(0))).y).toBeCloseTo(first.y, 3);
  await expect(marks.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(marks.nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('a Mark stays inside the page, and its size has a smallest and a largest', async ({
  page,
}) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();
  await addTo(page, 1).click();
  const mark = markOn(page, 1);
  await expect(mark).toBeFocused();

  // Far past every edge with Shift steps: it touches each and goes no further.
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowLeft');
  expect((await placeOnPageOne(page, mark)).x).toBeCloseTo(0, 3);
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowRight');
  const right = await placeOnPageOne(page, mark);
  expect(right.x + right.width).toBeCloseTo(1, 2);
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowUp');
  expect((await placeOnPageOne(page, mark)).y).toBeCloseTo(0, 3);
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowDown');
  const bottom = await placeOnPageOne(page, mark);
  expect(bottom.y + bottom.height).toBeCloseTo(1, 2);

  // Growing in a corner pulls it back in, and it stops at the page's width.
  for (let i = 0; i < 30; i++) await page.keyboard.press('+');
  const largest = await placeOnPageOne(page, mark);
  expect(largest.width).toBeLessThanOrEqual(1.001);
  expect(largest.x).toBeGreaterThanOrEqual(-0.001);
  expect(largest.y).toBeGreaterThanOrEqual(-0.001);
  expect(largest.y + largest.height).toBeLessThanOrEqual(1.001);
  for (let i = 0; i < 60; i++) await page.keyboard.press('-');
  // A twentieth of the page wide, though a Mark's tap area is never under 24 px.
  const smallest = await mark.evaluate((element) => parseFloat(element.style.width) / 100);
  expect(smallest).toBeCloseTo(0.05, 3);
});

test('Smaller, Bigger and Remove are at least 44 px, and named for their Mark', async ({
  page,
}) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();
  await addTo(page, 2).click();
  const mark = markOn(page, 2);
  await expect(mark).toBeFocused();
  const width = async () => (await mark.boundingBox())!.width;
  const before = await width();

  for (const [words, name] of [
    ['Bigger', 'Bigger: Signature on page 2'],
    ['Smaller', 'Smaller: Signature on page 2'],
    ['Remove', 'Remove: Signature on page 2'],
    ['Add to page 2', 'Add to page 2'],
  ] as const) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toHaveText(words);
    const box = (await button.boundingBox())!;
    expect(box.width, `${words} wide`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${words} high`).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Bigger: Signature on page 2' }).click();
  expect(await width()).toBeGreaterThan(before * 1.05);
  await page.getByRole('button', { name: 'Smaller: Signature on page 2' }).click();
  expect(await width()).toBeCloseTo(before, 0);
  await page.getByRole('button', { name: 'Remove: Signature on page 2' }).click();
  await expect(mark).toHaveCount(0);
  // Only a chosen Mark has buttons.
  await expect(page.getByRole('button', { name: /^Bigger:/ })).toHaveCount(0);
  await expect(addTo(page, 2)).toBeFocused();
});

test('dragging a Mark with the mouse moves it, and the saved PDF has it there', async ({
  page,
}) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await tapPageOne(page, 0.3, 0.3);
  const mark = markOn(page, 1);
  await expect(mark).toBeVisible();
  // A finger on a Mark drags it; a finger anywhere else on the page still scrolls.
  await expect(mark).toHaveCSS('touch-action', 'none');
  await expect(pageOne(page)).toHaveCSS('touch-action', 'auto');

  const before = await placeOnPageOne(page, mark);
  const box = (await mark.boundingBox())!;
  const sheet = (await pageOne(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();

  const after = await placeOnPageOne(page, mark);
  expect(after.x - before.x).toBeCloseTo(60 / sheet.width, 2);
  expect(after.y - before.y).toBeCloseTo(40 / sheet.height, 2);
  expect(after.width).toBeCloseTo(before.width, 3);
  // Dropping it on the page did not place a second Mark.
  await expect(markOn(page, 1)).toHaveCount(1);

  const signed = await savedPdf(page);
  const [picture, ...more] = picturesOn(signed.getPage(0));
  expect(more).toEqual([]);
  expectSavedAt(picture!, after);
  expect(await page.evaluate(() => (window as unknown as { blocked: string[] }).blocked)).toEqual(
    [],
  );
});

test('a drag that leaves the page stops at its edge', async ({ page }) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await tapPageOne(page, 0.5, 0.5);
  const mark = markOn(page, 1);
  const box = (await mark.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 2000, box.y + box.height / 2 - 2000, {
    steps: 8,
  });
  await page.mouse.up();
  const after = await placeOnPageOne(page, mark);
  expect(after.x + after.width).toBeCloseTo(1, 2);
  expect(after.y).toBeCloseTo(0, 2);
});

test('at 375 px wide nothing scrolls sideways, with a Mark chosen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();
  const sideways = () =>
    page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await sideways()).toBeLessThanOrEqual(0);
  for (const number of [1, 2, 3]) {
    await addTo(page, number).click();
    await page.getByRole('button', { name: `Bigger: Signature on page ${number}` }).waitFor();
    expect(await sideways()).toBeLessThanOrEqual(0);
  }
  // Every button, in the page tools and in the chosen Mark's row, fits and is 44 px.
  for (const name of [/^Add to page/, /^Smaller:/, /^Bigger:/, /^Remove:/]) {
    for (const button of await page.getByRole('button', { name }).all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
  }
  // Ends with a Mark chosen: the checks after the test cover both themes.
  await expect(markOn(page, 3)).toHaveAttribute('aria-pressed', 'true');
});

test('the pad draws instead of scrolling, and nothing is kept', async ({ page }) => {
  await page.goto('sign-pdf/');
  const pad = page.getByRole('img', { name: notes.padLabel });
  await expect(pad).toHaveCSS('touch-action', 'none');
  const before = await page.evaluate(() => window.scrollY);
  await drawSignature(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  // The ink shows on the pad.
  expect(await padHasInk(page)).toBe(true);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

/**
 * Notes every page viewer file the page asks for: by its name, or, whatever a file is
 * called, any script holding pdf.js's code. `loaded()` waits for the scripts to be read.
 */
function watchViewer(page: Page) {
  const found: string[] = [];
  const reading: Promise<void>[] = [];
  page.context().on('request', (request) => {
    if (isViewer(request.url())) found.push(request.url());
  });
  page.context().on('response', (response) => {
    if (!/\.m?js(\?|$)/.test(response.url())) return;
    reading.push(
      response.text().then(
        (code) => void (code.includes(pdfjsVersion) && found.push(response.url())),
        () => undefined,
      ),
    );
  });
  return {
    async loaded() {
      await Promise.all(reading);
      // Scripts were read, so finding none means something.
      expect(reading.length).toBeGreaterThan(0);
      return found;
    },
  };
}

test('the page viewer loads only once a PDF is chosen, with "Getting ready…"', async ({ page }) => {
  const viewer = watchViewer(page);
  await page.goto('sign-pdf/');
  await expect(page.getByRole('img', { name: notes.padLabel })).toBeVisible();
  expect(await viewer.loaded()).toEqual([]);
  // Hold the viewer back, so "Getting ready…" can be seen.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/_astro\/viewer[.-]/, async (route) => {
    await held;
    await route.continue();
  });
  await choose(page, [sample]);
  await expect(page.getByText('Getting ready…', { exact: true })).toBeVisible();
  release();
  await expect(pageOne(page)).toBeVisible();
  // The viewer's script is found twice: by its name, and by pdf.js's code in it.
  const found = await viewer.loaded();
  expect(found.filter((url) => /\/_astro\/viewer[.-]/.test(url)).length).toBe(2);
});

test('no other PDF Tool loads the page viewer', async ({ page }) => {
  const viewer = watchViewer(page);
  for (const other of ['rotate-pdf', 'split-pdf']) {
    await page.goto(`${other}/`);
    await choose(page, [sample]);
    await expect(page.getByText('sample.pdf', { exact: true })).toBeVisible();
  }
  expect(await viewer.loaded()).toEqual([]);
});

test('a PDF with a password shows the reason in place of its pages', async ({ page }) => {
  await page.goto('sign-pdf/');
  await choose(page, [locked]);
  await expect(page.getByText(tool.reasons.password!, { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: /^Page 1 of/ })).toHaveCount(0);
  await expect(start(page)).toBeDisabled();
});

test('a PDF already signed digitally shows the reason in place of its pages', async ({ page }) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [signed]);
  await expect(page.getByText(tool.reasons.digitallySigned!, { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: /^Page 1 of/ })).toHaveCount(0);
  await expect(start(page)).toBeDisabled();
});

test('a PDF with an empty signature field shows its pages and signs', async ({ page }) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [emptyField]);
  const sheet = page.getByRole('group', { name: 'Page 1 of sample-signature-field.pdf' });
  await expect(sheet).toBeVisible();
  await sheet.click();
  await expect(start(page)).toBeEnabled();
});

test('a turned, cropped page shows as it reads, and the saved Mark sits upright where it was tapped', async ({
  page,
}) => {
  // 400 × 300 points with a visible box 50..350 across and 20..220 up, turned a quarter
  // clockwise: it shows 200 across and 300 down.
  const made = await PDFDocument.create();
  const sheet = made.addPage([400, 300]);
  sheet.setCropBox(50, 20, 300, 200);
  sheet.setRotation(degrees(90));
  const buffer = Buffer.from(await made.save());
  await page.goto('sign-pdf/');
  await drawSignature(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?PDFs/).click();
  await (await chooser).setFiles({ name: 'turned.pdf', mimeType: 'application/pdf', buffer });

  const shown = page.getByRole('group', { name: 'Page 1 of turned.pdf' });
  await expect(shown).toBeVisible();
  // The editor shows the turned page: taller than wide, 200 : 300.
  const box = (await shown.boundingBox())!;
  expect(box.height / box.width).toBeCloseTo(1.5, 2);
  // Tapped a quarter in from the left and a quarter down from the top.
  await shown.click({ position: { x: box.width * 0.25, y: box.height * 0.25 } });
  await start(page).click();
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save turned_dtb_signed.pdf' }).click();
  const doc = await PDFDocument.load(await readFile((await (await saved).path())!));
  expect(doc.getPage(0).getRotation().angle).toBe(90);
  const [picture, ...more] = picturesOn(doc.getPage(0));
  expect(more).toEqual([]);
  // Shown 200 across and 300 down, the tap is 50 across and 75 down. Across counts up the
  // PDF on this page and down counts across it: from the visible box's lower-left (50, 20)
  // that is x = 50 + 75, y = 20 + 50. The picture is turned to read upright.
  const within = (value: number, expected: number) =>
    expect(Math.abs(value - expected)).toBeLessThan(2);
  within(picture!.x + picture!.width / 2, 125);
  within(picture!.y + picture!.height / 2, 70);
  expect(picture!.turn).toBe(90);
  // A third of the page across (66.7 points), now along the PDF's up; higher than wide
  // there, as the picture is wider than it is high on the page.
  within(picture!.height, 200 / 3);
  expect(picture!.width).toBeLessThan(picture!.height);
});

test('a long PDF draws its pages near view and frees them far away', async ({ page }) => {
  const long = await PDFDocument.create();
  for (let i = 0; i < 40; i++) long.addPage([300, 200]);
  const buffer = Buffer.from(await long.save());
  await page.goto('sign-pdf/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?PDFs/).click();
  await (await chooser).setFiles({ name: 'long.pdf', mimeType: 'application/pdf', buffer });

  const canvasOf = (n: number) =>
    page.getByRole('group', { name: `Page ${n} of long.pdf`, exact: true }).locator('canvas');
  const drawnWidth = (n: number) =>
    canvasOf(n).evaluate((canvas: HTMLCanvasElement) => canvas.width);
  await expect.poll(() => drawnWidth(1)).toBeGreaterThan(0);
  // Drawn at the width it shows, at 2 pixels to each CSS pixel: these phones have more.
  const ratio = await canvasOf(1).evaluate(
    (canvas: HTMLCanvasElement) => canvas.width / canvas.getBoundingClientRect().width,
  );
  expect(ratio).toBeGreaterThan(1.95);
  expect(ratio).toBeLessThanOrEqual(2);
  expect(await drawnWidth(40)).toBe(0);

  await canvasOf(40).scrollIntoViewIfNeeded();
  await expect.poll(() => drawnWidth(40)).toBeGreaterThan(0);
  await expect.poll(() => drawnWidth(1)).toBe(0);
});

test('a PDF that uses the standard fonts without holding them still shows its words', async ({
  page,
}) => {
  // Helvetica, Times and Courier named but not embedded: the device's own fonts stand in
  // (the standard font files are not served, see src/site/pdfjs-files.ts).
  const plain = await PDFDocument.create();
  const sheet = plain.addPage([300, 200]);
  let baseline = 160;
  for (const name of [StandardFonts.Helvetica, StandardFonts.TimesRoman, StandardFonts.Courier]) {
    sheet.drawText('Print name: Ana Diaz', {
      x: 20,
      y: baseline,
      size: 18,
      font: await plain.embedFont(name, { subset: false }),
    });
    baseline -= 50;
  }
  const buffer = Buffer.from(await plain.save());
  await page.goto('sign-pdf/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?PDFs/).click();
  await (await chooser).setFiles({ name: 'words.pdf', mimeType: 'application/pdf', buffer });

  // The page is 200 points high and each line sits in its own 50-point band from the top.
  // A drawn page's canvas is see-through except where there is ink.
  const inked = (band: number) =>
    page
      .getByRole('group', { name: 'Page 1 of words.pdf', exact: true })
      .locator('canvas')
      .evaluate((canvas: HTMLCanvasElement, band) => {
        const height = Math.floor(canvas.height / 4);
        const { data } = canvas
          .getContext('2d')!
          .getImageData(0, height * band, canvas.width, height);
        return data.filter((value, i) => i % 4 === 3 && value > 0).length;
      }, band);
  for (const band of [0, 1, 2]) {
    await expect.poll(() => inked(band), { message: `ink in band ${band}` }).toBeGreaterThan(100);
  }
});

/** The Text Mark's words box, which shows for the chosen Text Mark. */
const wordsOn = (page: Page, number: number) =>
  page.getByRole('textbox', { name: `Words: Text on page ${number}`, exact: true });

/** A page's Text Marks, by their label (Today's date is one too). */
const textOn = (page: Page, number: number) =>
  page.getByRole('button', { name: `Text on page ${number}`, exact: true });

/** Moves the page's last Text Mark up out of the way, 20% of the page. */
async function moveUp(page: Page, number: number) {
  await textOn(page, number).last().focus();
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
}

const kindRadio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });

test("adds Text and Today's date, edits the words, signs and saves", async ({ page }) => {
  await page.goto('sign-pdf/');
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();
  // The choice has all three kinds, Signature first.
  await expect(kindRadio(page, 'Signature')).toBeChecked();
  await expect(kindRadio(page, 'Text')).not.toBeChecked();
  await expect(kindRadio(page, "Today's date")).not.toBeChecked();
  await expect(page.getByText(tool.notes.nothingPlaced!, { exact: true })).toBeVisible();
  await expect(start(page)).toBeDisabled();

  // Text: a dashed box that names itself, and the words box ready to type in. With no
  // words it still counts as nothing placed.
  await kindRadio(page, 'Text').check();
  await addTo(page, 1).click();
  await expect(wordsOn(page, 1)).toBeFocused();
  await expect(textOn(page, 1)).toHaveText('Text');
  await expect(textOn(page, 1)).toHaveClass(/blank/);
  await expect(page.getByText(tool.notes.nothingPlaced!, { exact: true })).toBeVisible();
  await expect(start(page)).toBeDisabled();

  // Typing shows the words in the Mark and lets start go. Mark keys typed in the box
  // belong to the box: the minus and plus are letters here, and Backspace deletes one.
  await page.keyboard.type('Ana Diaz-+x');
  await page.keyboard.press('Backspace');
  await expect(wordsOn(page, 1)).toHaveValue('Ana Diaz-+');
  await expect(textOn(page, 1)).toHaveCount(1);
  await expect(textOn(page, 1).locator('img')).toHaveCount(1);
  await expect(textOn(page, 1)).not.toHaveClass(/blank/);
  await expect(start(page)).toBeEnabled();
  await wordsOn(page, 1).fill('Ana Diaz');
  await moveUp(page, 1);
  // A Mark's own picture is its place; a small Mark's tap area may reach past it.
  const name = await placeOnPageOne(page, textOn(page, 1).locator('img'));

  // Today's date: filled in, and still editable.
  await kindRadio(page, "Today's date").check();
  await addTo(page, 1).click();
  await expect(textOn(page, 1)).toHaveCount(2);
  await expect(textOn(page, 1).nth(1)).toBeFocused();
  const date = await wordsOn(page, 1).inputValue();
  expect(date).toMatch(/\d/);
  await wordsOn(page, 1).fill('4 March');
  await expect(wordsOn(page, 1)).toHaveValue('4 March');
  const second = await placeOnPageOne(page, textOn(page, 1).nth(1).locator('img'));
  expect(second.width).toBeLessThan(name.width);

  // Choosing the first Mark brings its words back.
  await textOn(page, 1).first().click();
  await expect(wordsOn(page, 1)).toHaveValue('Ana Diaz');

  const saved = await savedPdf(page);
  const pictures = picturesOn(saved.getPage(0));
  expect(pictures).toHaveLength(2);
  expectSavedAt(pictures[0]!, name);
  expectSavedAt(pictures[1]!, second);
  // Words are wider than they are high.
  expect(pictures[0]!.width).toBeGreaterThan(pictures[0]!.height * 2);
  expect(picturesOn(saved.getPage(1))).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { blocked: string[] }).blocked)).toEqual(
    [],
  );
});

test('words keep their size as they grow, and a Mark with them removed is left out', async ({
  page,
}) => {
  await page.goto('sign-pdf/');
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();
  await kindRadio(page, 'Text').check();
  await addTo(page, 1).click();
  await page.keyboard.type('Ana');
  const short = await placeOnPageOne(page, textOn(page, 1).locator('img'));
  await page.keyboard.type(' Diaz Lopez');
  const long = await placeOnPageOne(page, textOn(page, 1).locator('img'));
  expect(long.width).toBeGreaterThan(short.width * 2);
  // The letters are the same size: the height holds.
  expect(long.height).toBeCloseTo(short.height, 2);

  // Emptied, it is nothing again, and a second Mark with words is all that is saved.
  await wordsOn(page, 1).fill('   ');
  await expect(start(page)).toBeDisabled();
  await kindRadio(page, "Today's date").check();
  await addTo(page, 1).click();
  await expect(start(page)).toBeEnabled();
  const saved = await savedPdf(page);
  expect(picturesOn(saved.getPage(0))).toHaveLength(1);
});

test('words in Japanese and Arabic are kept as typed, shown and saved', async ({ page }) => {
  await page.goto('sign-pdf/');
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();
  await kindRadio(page, 'Text').check();
  for (const words of ['サイン', 'توقيع']) {
    await addTo(page, 1).click();
    await wordsOn(page, 1).fill(words);
    await expect(wordsOn(page, 1)).toHaveValue(words);
    // Out of the way of the next.
    if (words === 'サイン') await moveUp(page, 1);
  }
  await expect(textOn(page, 1)).toHaveCount(2);
  await expect(textOn(page, 1).nth(1).locator('img')).toHaveCount(1);
  // Each Mark has a picture of its own: the first Mark's words didn't change.
  await textOn(page, 1).first().click();
  await expect(wordsOn(page, 1)).toHaveValue('サイン');
  const saved = await savedPdf(page);
  expect(picturesOn(saved.getPage(0))).toHaveLength(2);
});

test('a tap places Text with its box ready, and nothing scrolls sideways at 375 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('sign-pdf/');
  await choose(page, [sample]);
  await kindRadio(page, 'Text').check();
  await tapPageOne(page, 0.5, 0.4);
  await expect(wordsOn(page, 1)).toBeFocused();
  await page.keyboard.type('A name that is rather long to print on a small page');
  const box = (await wordsOn(page, 1).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
  // The Mark stays inside the page however long the words.
  const place = await placeOnPageOne(page, textOn(page, 1).locator('img'));
  expect(place.x).toBeGreaterThanOrEqual(-0.001);
  expect(place.x + place.width).toBeLessThanOrEqual(1.001);
  expect(place.y + place.height).toBeLessThanOrEqual(1.001);
});

test("arrow and Delete keys typed in a Text Mark's words belong to the box", async ({ page }) => {
  await page.goto('sign-pdf/');
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();
  await kindRadio(page, 'Text').check();
  await addTo(page, 1).click();
  await page.keyboard.type('Ana Diaz');
  const before = await placeOnPageOne(page, textOn(page, 1).locator('img'));
  // The arrows move the caret and Delete takes the letter after it: the Mark stays where
  // it is and is not removed, even with Shift (which would move a Mark ten percent).
  for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'Delete']) {
    await page.keyboard.press(key);
  }
  for (const key of [
    'ArrowUp',
    'ArrowDown',
    'Shift+ArrowUp',
    'Shift+ArrowDown',
    'Shift+ArrowLeft',
  ]) {
    await page.keyboard.press(key);
  }
  await expect(wordsOn(page, 1)).toHaveValue('Ana Daz');
  await expect(textOn(page, 1)).toHaveCount(1);
  const after = await placeOnPageOne(page, textOn(page, 1).locator('img'));
  expect(after.x).toBeCloseTo(before.x, 2);
  expect(after.y).toBeCloseTo(before.y, 2);
});

// 4 March 2026 at ten in the morning, UTC: the same day anywhere a person might be.
const fixedDay = new Date('2026-03-04T10:00:00Z');

for (const [locale, expected] of [
  ['en-GB', '04/03/2026'],
  ['en-US', '3/4/2026'],
] as const) {
  test.describe(`on a device set to ${locale}`, () => {
    test.use({ locale, timezoneId: 'UTC' });

    test("Today's date is the device's short date", async ({ page }) => {
      // The words as the browser's own formatting gives them, from a fixed day.
      expect(fixedDay.toLocaleDateString(locale, { timeZone: 'UTC' })).toBe(expected);
      await page.clock.setFixedTime(fixedDay);
      await page.goto('sign-pdf/');
      await choose(page, [sample]);
      await expect(pageOne(page)).toBeVisible();
      await kindRadio(page, "Today's date").check();
      await addTo(page, 1).click();
      await expect(wordsOn(page, 1)).toHaveValue(expected);
      // And it is what is saved: a picture where the Mark is.
      expect(picturesOn((await savedPdf(page)).getPage(0))).toHaveLength(1);
    });
  });
}

/** The Dancing Script file: any request for it, by its name. */
const isTypedFont = (url: string) => /dancing-script.*\.woff2/.test(url);

/** The mean colour of a picture's solid pixels, or null if it has none. */
const inkOf = (picture: Locator) =>
  picture.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const sum = [0, 0, 0];
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 250) continue;
      for (const channel of [0, 1, 2]) sum[channel]! += data[i + channel]!;
      count++;
    }
    return count === 0 ? null : sum.map((total) => Math.round(total / count));
  });

const typeInstead = (page: Page) =>
  page.getByRole('button', { name: notes.typeItInstead, exact: true });
const typedBox = (page: Page) => page.getByRole('textbox', { name: notes.typedLabel });

test('Type it instead loads the font only then, and a typed Signature is placed, signed and saved', async ({
  page,
}) => {
  const fontRequests: string[] = [];
  page.context().on('request', (request) => {
    if (isTypedFont(request.url())) fontRequests.push(request.url());
  });
  await page.goto('sign-pdf/');
  await expect(page.getByRole('img', { name: notes.padLabel })).toBeVisible();
  await choose(page, [sample]);
  await expect(pageOne(page)).toBeVisible();
  await addTo(page, 1).click();
  await expect(markOn(page, 1)).toBeVisible();
  // Nothing has asked for the font yet, and a Signature is still wanted.
  expect(fontRequests).toEqual([]);
  await expect(page.getByText(tool.notes.noSignature!, { exact: true })).toBeVisible();

  await typeInstead(page).click();
  await expect(typedBox(page)).toBeFocused();
  await expect(page.getByRole('img', { name: notes.padLabel })).toHaveCount(0);
  // Words are still wanted: the box is empty.
  await expect(page.getByText(tool.notes.noSignature!, { exact: true })).toBeVisible();
  await expect(start(page)).toBeDisabled();
  expect(fontRequests).toHaveLength(1);
  expect(new URL(fontRequests[0]!).origin).toBe(new URL(page.url()).origin);

  await page.keyboard.type('Ada Lovelace');
  await expect(typedBox(page)).toHaveValue('Ada Lovelace');
  await expect(start(page)).toBeEnabled();
  await expect(markOn(page, 1).locator('img')).toHaveCount(1);
  // The font is the page's own, loaded, for its box and for painting.
  expect(
    await page.evaluate(() =>
      [...document.fonts].some(
        (face) => face.family.includes('Dancing Script') && face.status === 'loaded',
      ),
    ),
  ).toBe(true);
  // The box does not suggest, fill in or spell-check the Signature.
  await expect(typedBox(page)).toHaveAttribute('autocomplete', 'off');

  const shown = await placeOnPageOne(page, markOn(page, 1).locator('img'));
  const [picture, ...more] = picturesOn((await savedPdf(page)).getPage(0));
  expect(more).toEqual([]);
  expectSavedAt(picture!, shown);
  // Words are wider than they are high.
  expect(picture!.width).toBeGreaterThan(picture!.height * 2);
  // Still one request for the font, and the browser lock was never hit.
  expect(fontRequests).toHaveLength(1);
  expect(await page.evaluate(() => (window as unknown as { blocked: string[] }).blocked)).toEqual(
    [],
  );
});

test('Draw it instead brings the pad back with its lines, and the Signature is the way chosen last', async ({
  page,
}) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await tapPageOne(page, 0.5, 0.5);
  await expect(start(page)).toBeEnabled();

  await typeInstead(page).click();
  // Typing is the Signature now, and it is empty.
  await expect(page.getByText(tool.notes.noSignature!, { exact: true })).toBeVisible();
  await expect(start(page)).toBeDisabled();
  await typedBox(page).fill('Ada');
  await expect(start(page)).toBeEnabled();

  await page.getByRole('button', { name: notes.drawItInstead, exact: true }).click();
  await expect(page.getByRole('img', { name: notes.padLabel })).toBeVisible();
  await expect(typedBox(page)).toHaveCount(0);
  // The lines drawn before are still there, and are the Signature again.
  await expect.poll(() => padHasInk(page)).toBe(true);
  await expect(start(page)).toBeEnabled();

  // And the words typed before come back.
  await typeInstead(page).click();
  await expect(typedBox(page)).toHaveValue('Ada');
});

test('words in other scripts are kept as typed in a typed Signature', async ({ page }) => {
  await page.goto('sign-pdf/');
  await typeInstead(page).click();
  await typedBox(page).fill('Zoë サイン توقيع');
  await choose(page, [sample]);
  await tapPageOne(page, 0.5, 0.5);
  await expect(typedBox(page)).toHaveValue('Zoë サイン توقيع');
  await expect(markOn(page, 1).locator('img')).toHaveCount(1);
  const picture = picturesOn((await savedPdf(page)).getPage(0));
  expect(picture).toHaveLength(1);
});

test('ink is black unless Blue is chosen, and blue shows on a drawn Signature, a typed one and Text', async ({
  page,
}) => {
  await page.goto('sign-pdf/');
  const radio = (name: string) => page.getByRole('radio', { name, exact: true });
  await expect(radio(notes.inkBlack!)).toBeChecked();
  await expect(radio(notes.inkBlue!)).not.toBeChecked();
  await drawSignature(page);
  await choose(page, [sample]);
  await tapPageOne(page, 0.5, 0.3);
  const drawnMark = markOn(page, 1).locator('img');
  await expect(drawnMark).toHaveCount(1);
  await expect.poll(() => inkOf(drawnMark)).toEqual([0, 0, 0]);

  // Blue repaints the Mark already placed.
  await radio(notes.inkBlue!).check();
  const blue = [26, 63, 176];
  await expect.poll(() => inkOf(drawnMark)).toEqual(blue);
  // The pad shows it too.
  expect(
    await page.getByRole('img', { name: notes.padLabel }).evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      const solid = Array.from({ length: data.length / 4 }, (_, i) => i * 4).find(
        (i) => data[i + 3]! === 255,
      );
      return solid === undefined ? null : [data[solid]!, data[solid + 1]!, data[solid + 2]!];
    }),
  ).toEqual(blue);

  // A typed Signature, in the same ink: every Signature Mark follows it.
  await typeInstead(page).click();
  await typedBox(page).fill('Ada');
  await expect(typedBox(page)).toHaveCSS('color', 'rgb(26, 63, 176)');
  await expect(drawnMark).toHaveCount(1);
  await expect.poll(() => inkOf(drawnMark)).toEqual(blue);

  // Text, in the same ink.
  await page.getByRole('radio', { name: 'Text', exact: true }).check();
  await addTo(page, 1).click();
  await page.keyboard.type('Ada Lovelace');
  const textMark = page.getByRole('button', { name: 'Text on page 1', exact: true }).locator('img');
  await expect(textMark).toHaveCount(1);
  await expect.poll(() => inkOf(textMark)).toEqual(blue);
  await expect(start(page)).toBeEnabled();
});

test('no Signature, drawn or typed, is stored anywhere', async ({ page }) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await typeInstead(page).click();
  await typedBox(page).fill('Ada Lovelace');
  await choose(page, [sample]);
  await tapPageOne(page, 0.5, 0.5);
  await expect(start(page)).toBeEnabled();
  const stored = () =>
    page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookie: document.cookie,
      databases: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
      hash: location.hash + location.search,
    }));
  const none = { local: 0, session: 0, cookie: '', databases: 0, caches: 0, hash: '' };
  expect(await stored()).toEqual(none);

  // A new visit starts empty: no pad lines, no words.
  await page.reload();
  await expect(page.getByRole('img', { name: notes.padLabel })).toBeVisible();
  expect(await padHasInk(page)).toBe(false);
  await typeInstead(page).click();
  await expect(typedBox(page)).toHaveValue('');
  expect(await stored()).toEqual(none);
});
