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

test('Remove takes a Mark away', async ({ page }) => {
  await page.goto('sign-pdf/');
  await drawSignature(page);
  await choose(page, [sample]);
  await tapPageOne(page, 0.3, 0.3);
  // A new Mark is chosen, so its buttons show; a tap on it lets it go and chooses it again.
  const mark = page.getByRole('button', { name: 'Signature on page 1', exact: true });
  await expect(mark).toHaveAttribute('aria-pressed', 'true');
  await mark.click();
  await expect(mark).toHaveAttribute('aria-pressed', 'false');
  await mark.click();
  await expect(mark).toHaveAttribute('aria-pressed', 'true');
  const remove = page.getByRole('button', { name: 'Remove the signature on page 1' });
  const box = (await remove.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await remove.click();
  await expect(mark).toHaveCount(0);
  await expect(page.getByText(tool.notes.nothingPlaced!, { exact: true })).toBeVisible();
  await expect(start(page)).toBeDisabled();
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
