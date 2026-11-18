// Sign a PDF end to end, in a real browser: the Signature pad, the page viewer loading
// only here, placing and removing a Mark, start held back until there is something to
// sign, the password reason in place of the pages, and the saved PDF.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { test, expect } from './fixtures';
import { tool } from '../../src/tools/sign-pdf/declaration';
import { picturesOn } from '../../src/tools/sign-pdf/pictures-on';

const samples = fileURLToPath(new URL('../../src/tools/sign-pdf/', import.meta.url));
// Three pages, each 300 × 200 points.
const sample = `${samples}sample.pdf`;
const locked = `${samples}sample-password.pdf`;
const notes = tool.notes as Record<string, string>;

/** The page viewer's files: pdf.js's own code and its worker. */
const isViewer = (url: string) => /\/_astro\/(viewer|pdf\.worker)[.-]|\/pdfjs\//.test(url);

async function choose(page: Page, files: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?PDFs/).click();
  await (await chooser).setFiles(files);
}

/** Draws a zigzag across the pad with the mouse. */
async function drawSignature(page: Page) {
  const pad = page.getByRole('img', { name: notes.padLabel });
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.6);
  await page.mouse.down();
  for (const [x, y] of [
    [0.3, 0.3],
    [0.5, 0.7],
    [0.7, 0.3],
    [0.9, 0.6],
  ] as const) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 4 });
  }
  await page.mouse.up();
}

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
  const smallest = await placeOnPageOne(page, mark);
  expect(smallest.width).toBeCloseTo(0.05, 2);
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
  expect(
    await pad.evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      return data.some((value, i) => i % 4 === 3 && value > 0);
    }),
  ).toBe(true);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

test('the page viewer loads only once a PDF is chosen, with "Getting ready…"', async ({ page }) => {
  const viewerRequests: string[] = [];
  page.context().on('request', (request) => {
    if (isViewer(request.url())) viewerRequests.push(request.url());
  });
  await page.goto('sign-pdf/');
  await expect(page.getByRole('img', { name: notes.padLabel })).toBeVisible();
  expect(viewerRequests).toEqual([]);
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
  expect(viewerRequests.length).toBeGreaterThan(0);
});

test('no other PDF Tool loads the page viewer', async ({ page }) => {
  const viewerRequests: string[] = [];
  page.context().on('request', (request) => {
    if (isViewer(request.url())) viewerRequests.push(request.url());
  });
  for (const other of ['rotate-pdf', 'split-pdf']) {
    await page.goto(`${other}/`);
    await choose(page, [sample]);
    await expect(page.getByText('sample.pdf', { exact: true })).toBeVisible();
  }
  expect(viewerRequests).toEqual([]);
});

test('a PDF with a password shows the reason in place of its pages', async ({ page }) => {
  await page.goto('sign-pdf/');
  await choose(page, [locked]);
  await expect(page.getByText(tool.reasons.password!, { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: /^Page 1 of/ })).toHaveCount(0);
  await expect(start(page)).toBeDisabled();
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
