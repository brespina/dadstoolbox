// Change image file type end to end, in a real browser: the canvas, the browser's own
// photo opening, and Batches across presses of the start button.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import exifr from 'exifr';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const folder = fileURLToPath(new URL('../../src/tools/change-image-type/', import.meta.url));
// Stored 48 × 32 and marked "turn a quarter turn", with a date taken and a location.
const sample = `${folder}rotated.jpg`;
// An iPhone photo (HEIC), stored 48 × 32 and marked "turn a quarter turn", with a date
// taken and a location.
const iphone = `${folder}sample.heic`;
const seeThrough = `${folder}transparent.png`;

async function choose(page: Page, files: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?images/).click();
  await (await chooser).setFiles(files);
}

/** Saves the named result through a normal save and reads its photo details. */
async function saveAndRead(page: Page, name: string) {
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: `Save ${name}` }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe(name);
  const bytes = readFileSync((await download.path())!);
  return (await exifr.parse(bytes, { gps: true, reviveValues: false, translateValues: false })) as
    Record<string, unknown> | undefined;
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
  await page.goto('change-image-type/');
});

test('a photo becomes a JPG the right way up, with the date taken and no location', async ({
  page,
}) => {
  await expect(page.getByRole('checkbox', { name: /Remove location/ })).toBeChecked();
  await choose(page, [sample, seeThrough]);
  await page.getByRole('button', { name: 'Change to JPG' }).click();
  await expect(page.getByText('All done. Location data removed.')).toBeVisible();
  expect(await thumbnailSize(page, 'rotated_dtb.jpg')).toEqual([32, 48]);

  const found = await saveAndRead(page, 'rotated_dtb.jpg');
  expect(found).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00' });
  expect(found).not.toHaveProperty('latitude');
  expect(found?.Orientation ?? 1).toBe(1);
});

test('unticked, Remove location keeps the location', async ({ page }) => {
  await page.getByRole('checkbox', { name: /Remove location/ }).uncheck();
  await choose(page, [sample, seeThrough]);
  await page.getByRole('button', { name: 'Change to JPG' }).click();
  await expect(page.getByText('All done.', { exact: true })).toBeVisible();
  const found = await saveAndRead(page, 'rotated_dtb.jpg');
  expect(found!.latitude).toBeCloseTo(30.2672, 4);
  expect(found).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00' });
});

test('see-through parts of a PNG turn white in a JPG', async ({ page }) => {
  await choose(page, [seeThrough]);
  await page.getByRole('button', { name: 'Change to JPG' }).click();
  const pixel = await page
    .getByRole('listitem')
    .filter({ hasText: 'transparent_dtb.jpg' })
    .locator('img')
    .evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(img, 0, 0);
      return [...context.getImageData(5, 5, 1, 1).data];
    });
  for (const channel of pixel) expect(channel).toBeGreaterThan(245);
});

test('WebP is offered only where the browser can save it', async ({ page }) => {
  const canSave = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        canvas.toBlob((blob) => resolve(blob?.type === 'image/webp'), 'image/webp');
      }),
  );
  await expect(page.getByRole('radio', { name: /^PNG/ })).toBeAttached();
  await expect(page.getByRole('radio', { name: /^WebP/ })).toHaveCount(canSave ? 1 : 0);
  if (!canSave) return;
  await page.getByText('WebP', { exact: true }).click();
  await choose(page, [sample]);
  await page.getByRole('button', { name: 'Change to WebP' }).click();
  await expect(page.getByRole('button', { name: 'Save rotated_dtb.webp' })).toBeVisible();
});

test('an iPhone photo (HEIC) becomes a JPG the right way up, with the date taken', async ({
  page,
}) => {
  const canOpen = await page.evaluate(
    async (bytes) => {
      try {
        (
          await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/heic' }))
        ).close();
        return true;
      } catch {
        return false;
      }
    },
    [...readFileSync(iphone)],
  );

  // The fallback decoder is big, so it never loads with the page.
  const decoderAsked: string[] = [];
  page.on('request', (request) => {
    if (/\/heic-to\.[^/]*\.js$/.test(request.url())) decoderAsked.push(request.url());
  });
  const workers: string[] = [];
  page.on('worker', (worker) => workers.push(worker.url()));
  // Hold the decoder back until "Getting ready…" has been seen.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/heic-to\.[^/]*\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(decoderAsked, 'the decoder loaded with the page').toEqual([]);

  await choose(page, [iphone]);
  await page.getByRole('button', { name: 'Change to JPG' }).click();
  if (!canOpen) {
    // Chrome has no decoder of its own, so the fallback loads now.
    await expect(page.getByText('Getting ready…')).toBeVisible();
  }
  release();
  await expect(page.getByText('All done. Location data removed.')).toBeVisible();
  expect(await thumbnailSize(page, 'sample_dtb.jpg')).toEqual([32, 48]);
  const found = await saveAndRead(page, 'sample_dtb.jpg');
  expect(found).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00' });
  expect(found).not.toHaveProperty('latitude');
  expect(found?.Orientation ?? 1).toBe(1);

  if (canOpen) {
    // Safari opens it itself, and the fallback never loads.
    expect(decoderAsked).toEqual([]);
  } else {
    expect(decoderAsked).toHaveLength(1);
    // The fallback decodes in its own worker, so the page stays responsive.
    expect(workers.some((url) => url.startsWith('blob:'))).toBe(true);
  }
});

test('changing the format and pressing start again adds a Batch on top', async ({ page }) => {
  await page.addInitScript(() => {
    const shared: string[][] = [];
    Object.assign(window, { shared });
    navigator.canShare = () => true;
    navigator.share = async (data?: ShareData) => {
      shared.push((data?.files ?? []).map((f) => f.name));
    };
  });
  await page.reload();
  await choose(page, [sample, seeThrough]);
  await page.getByRole('button', { name: 'Change to JPG' }).click();
  await expect(page.getByRole('button', { name: 'Save transparent_dtb.jpg' })).toBeVisible();
  // Nothing new to do with the same options.
  await expect(page.getByRole('button', { name: 'Change to JPG' })).toBeDisabled();

  await page.getByText('PNG', { exact: true }).click();
  await page.getByRole('button', { name: 'Change to PNG' }).click();
  await expect(page.getByRole('button', { name: 'Save transparent_dtb.png' })).toBeVisible();

  await expect(page.locator('section.batch h2')).toHaveText(['PNG · 2 images', 'JPG · 2 images']);
  // Earlier Batches keep their own Save buttons.
  await expect(page.getByRole('button', { name: 'Save rotated_dtb.jpg' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save all' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Save all' }).click();
  expect(await page.evaluate(() => (window as unknown as { shared: string[][] }).shared)).toEqual([
    ['rotated_dtb.png', 'transparent_dtb.png'],
  ]);
});

test('Choose more and start again does only the new image', async ({ page }) => {
  await choose(page, [seeThrough]);
  await page.getByRole('button', { name: 'Change to JPG' }).click();
  await expect(page.getByRole('button', { name: 'Save transparent_dtb.jpg' })).toBeVisible();

  await choose(page, [`${folder}painted.webp`]);
  const waiting = page.getByRole('region', { name: 'Ready to start' });
  await expect(waiting.getByRole('listitem')).toHaveCount(1);
  await expect(waiting.getByText('painted.webp')).toBeVisible();
  await page.getByRole('button', { name: 'Change to JPG' }).click();

  await expect(page.locator('section.batch h2')).toHaveText(['JPG · 1 image', 'JPG · 1 image']);
  const newest = page.locator('section.batch').first();
  await expect(newest.getByRole('button', { name: /^Save / })).toHaveText(['Save']);
  await expect(newest.getByRole('button', { name: 'Save painted_dtb.jpg' })).toBeVisible();
});

test('choosing only JPGs hides JPG and moves the choice to the first type left', async ({
  page,
}) => {
  await expect(page.getByRole('radio', { name: /^JPG/ })).toBeChecked();
  await choose(page, [sample]);
  await expect(page.getByRole('radio', { name: /^JPG/ })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /^PNG/ })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Change to PNG' })).toBeEnabled();
});

test('choosing a JPG and a PNG offers every type', async ({ page }) => {
  await choose(page, [sample, seeThrough]);
  await expect(page.getByRole('radio', { name: /^JPG/ })).toBeAttached();
  await expect(page.getByRole('radio', { name: /^PNG/ })).toBeAttached();
});

test('a JPG chosen with a PNG is saved as a JPG again, with its location removed', async ({
  page,
}) => {
  await choose(page, [sample, seeThrough]);
  await page.getByRole('button', { name: 'Change to JPG' }).click();
  await expect(page.getByText('All done. Location data removed.')).toBeVisible();
  const found = await saveAndRead(page, 'rotated_dtb.jpg');
  expect(found).toMatchObject({ DateTimeOriginal: '2024:06:01 10:30:00' });
  expect(found).not.toHaveProperty('latitude');
});

test('the old address forwards to the new page', async ({ page }) => {
  await page.goto('photo-to-jpg/');
  await expect(page).toHaveURL(/\/change-image-type\/$/);
  await expect(page.getByRole('heading', { name: 'Change image file type' })).toBeVisible();
});

test('the old address has a link for people without scripts', async ({ page }) => {
  const response = await page.request.get('photo-to-jpg/');
  expect(await response.text()).toMatch(/<a href="[^"]*\/change-image-type\/">/);
});
