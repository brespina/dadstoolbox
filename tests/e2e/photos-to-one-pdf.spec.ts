// Photos to one PDF end to end, in a real browser: the browser's own photo opening (or
// the fallback decoder for an iPhone photo), the canvas drawing, the order and the pages.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDict, PDFDocument, PDFName, PDFNumber, PDFStream } from 'pdf-lib';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const photos = (tool: string) =>
  fileURLToPath(new URL(`../../src/tools/${tool}/`, import.meta.url));
// Stored 4032 × 3024 and marked "turn a quarter turn", so it shows tall. Has a location.
const jpg = `${photos('make-photo-smaller')}sample.jpg`;
// An iPhone photo (HEIC), stored 48 × 32 and marked "turn a quarter turn". Has a location.
const heic = `${photos('make-photo-smaller')}IMG_1234.HEIC`;
// A wide 20 × 10 PNG.
const png = `${photos('change-image-type')}transparent.png`;

async function choose(page: Page, files: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?photos/).click();
  await (await chooser).setFiles(files);
}

const waitingNames = (page: Page) =>
  page.getByRole('region', { name: 'Ready to start' }).getByRole('listitem').locator('.file-name');

/** Each page's size in points, and the size in pixels of the photo drawn on it. */
async function pages(pdf: PDFDocument) {
  return pdf.getPages().map((page) => {
    const pictures = page.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
    const [picture] = pictures.values().map((ref) => pdf.context.lookup(ref, PDFStream));
    const pixels = (key: string) => picture!.dict.lookup(PDFName.of(key), PDFNumber).asNumber();
    return {
      page: [page.getWidth(), page.getHeight()],
      photo: [pixels('Width'), pixels('Height')],
    };
  });
}

test('a JPG, an iPhone photo (HEIC) and a wide photo, in a set order, give one Letter page each', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await page.goto('photos-to-one-pdf/');
  await choose(page, [heic, png, jpg]);
  await page.getByRole('button', { name: 'Move sample.jpg up' }).click();
  await page.getByRole('button', { name: 'Move sample.jpg up' }).click();
  await expect(waitingNames(page)).toHaveText(['sample.jpg', 'IMG_1234.HEIC', 'transparent.png']);

  await page.getByRole('button', { name: 'Make one PDF' }).click();
  const saved = page.waitForEvent('download');
  // The fallback decoder for the iPhone photo can take a while to load.
  await page.getByRole('button', { name: 'Save combined_dtb.pdf' }).click({ timeout: 30_000 });
  const download = await saved;
  expect(download.suggestedFilename()).toBe('combined_dtb.pdf');
  const bytes = await readFile(await download.path());

  expect(await pages(await PDFDocument.load(bytes))).toEqual([
    // Turned the right way up, and drawn about 300 dots an inch: sharp enough for a receipt.
    { page: [612, 792], photo: [2250, 3000] },
    { page: [612, 792], photo: [32, 48] },
    // The wide photo gets a sideways page.
    { page: [792, 612], photo: [20, 10] },
  ]);
  // The photos were drawn afresh, so none of their details (or location) came along.
  expect(bytes.includes('Exif')).toBe(false);
});
