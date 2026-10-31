// Make a photo smaller end to end, in a real browser: the browser's own photo opening,
// the canvas drawing it smaller, and Remove location.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import exifr from 'exifr';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const folder = fileURLToPath(new URL('../../src/tools/make-photo-smaller/', import.meta.url));
// Stored 4032 × 3024 and marked "turn a quarter turn", with a date taken and a location.
const sample = `${folder}sample.jpg`;

async function choose(page: Page, files: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?photos/).click();
  await (await chooser).setFiles(files);
}

/** Saves the named result through a normal save: its size and photo details. */
async function saveAndRead(page: Page, name: string) {
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: `Save ${name}` }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe(name);
  const bytes = readFileSync((await download.path())!);
  const details = (await exifr.parse(bytes, {
    gps: true,
    reviveValues: false,
    translateValues: false,
  })) as Record<string, unknown> | undefined;
  return { size: bytes.length, details };
}

/** The width and height of a result's thumbnail picture. */
const thumbnailSize = (page: Page, name: string) =>
  page
    .getByRole('listitem')
    .filter({ hasText: name })
    .locator('img')
    .evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await page.goto('make-photo-smaller/');
});

test('a large photo comes out smaller, the right way up, with the date taken and no location', async ({
  page,
}) => {
  await expect(page.getByRole('radio', { name: /^Medium/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Remove location/ })).toBeChecked();
  await choose(page, [sample]);
  await page.getByRole('button', { name: 'Make smaller' }).click();
  await expect(page.getByText('All done. Location data removed.')).toBeVisible();
  await expect(page.locator('section.batch h2')).toHaveText(['Medium · 1 photo']);
  // The row shows the size before → after.
  await expect(page.getByText(/ → /)).toBeVisible();
  expect(await thumbnailSize(page, 'sample_dtb_small.jpg')).toEqual([1536, 2048]);

  const { size, details } = await saveAndRead(page, 'sample_dtb_small.jpg');
  expect(size).toBeLessThan(statSync(sample).size);
  expect(details).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00' });
  expect(details).not.toHaveProperty('latitude');
  expect(details?.Orientation ?? 1).toBe(1);
});

test('unticked, Remove location keeps the location', async ({ page }) => {
  await page.getByRole('checkbox', { name: /Remove location/ }).uncheck();
  await choose(page, [sample]);
  await page.getByRole('button', { name: 'Make smaller' }).click();
  await expect(page.getByText('All done.', { exact: true })).toBeVisible();
  await expect(page.locator('section.batch h2')).toHaveText(['Medium, location kept · 1 photo']);
  const { details } = await saveAndRead(page, 'sample_dtb_small.jpg');
  expect(details!.latitude).toBeCloseTo(30.2672, 4);
  expect(details).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00' });
});

test('Tiny makes it smaller than Medium, and each press adds a Batch', async ({ page }) => {
  await choose(page, [sample]);
  await page.getByRole('button', { name: 'Make smaller' }).click();
  const medium = await saveAndRead(page, 'sample_dtb_small.jpg');

  await page.getByText('Tiny', { exact: true }).click();
  await page.getByRole('button', { name: 'Make smaller' }).click();
  await expect(page.locator('section.batch h2')).toHaveText(['Tiny · 1 photo', 'Medium · 1 photo']);
  expect(await thumbnailSize(page, 'sample_dtb_small_2.jpg')).toEqual([600, 800]);
  const tiny = await saveAndRead(page, 'sample_dtb_small_2.jpg');
  expect(tiny.size).toBeLessThan(medium.size);
});

test('a photo already under the size keeps its width and height', async ({ page }) => {
  // 32 × 48 once turned the right way up.
  await choose(page, [
    fileURLToPath(new URL('../../src/tools/change-image-type/rotated.jpg', import.meta.url)),
  ]);
  await page.getByRole('button', { name: 'Make smaller' }).click();
  expect(await thumbnailSize(page, 'rotated_dtb_small.jpg')).toEqual([32, 48]);
});

test('an iPhone photo (HEIC) comes out as a JPG, here or through the fallback decoder', async ({
  page,
}) => {
  // Stored 48 × 32 and marked "turn a quarter turn", with a date taken and a location.
  await choose(page, [`${folder}IMG_1234.HEIC`]);
  await page.getByRole('button', { name: 'Make smaller' }).click();
  await expect(page.getByText('All done. Location data removed.')).toBeVisible();
  expect(await thumbnailSize(page, 'IMG_1234_dtb_small.jpg')).toEqual([32, 48]);
  const { details } = await saveAndRead(page, 'IMG_1234_dtb_small.jpg');
  expect(details).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00' });
  expect(details).not.toHaveProperty('latitude');
});
