// Change image file type end to end, in a real browser: the canvas, the browser's own
// photo opening, and Batches across presses of the start button.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import exifr from 'exifr';
import { PNG } from 'pngjs';
import type { FileChooser, Page } from '@playwright/test';
import { test, expect } from './fixtures';

const folder = fileURLToPath(new URL('../../src/tools/change-image-type/', import.meta.url));
// Stored 48 × 32 and marked "turn a quarter turn", with a date taken and a location.
const sample = `${folder}rotated.jpg`;
// An iPhone photo (HEIC), stored 48 × 32 and marked "turn a quarter turn", with a date
// taken and a location.
const iphone = `${folder}sample.heic`;
const seeThrough = `${folder}transparent.png`;
// 32 × 48, 24-bit.
const bmp = `${folder}sample.bmp`;
// 32 × 48, the left half red and the right half see-through.
const avif = `${folder}sample.avif`;
// 40 × 30 as stated, the left half red and the right half see-through.
const sizedSvg = `${folder}sized.svg`;
// The same shape, with a viewBox of 40 × 30 and no stated size.
const viewBoxSvg = `${folder}viewbox-only.svg`;

async function choose(page: Page, files: Parameters<FileChooser['setFiles']>[0]) {
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

/** The red, green, blue and alpha of a result's thumbnail at (x, y). */
const pixelAt = (page: Page, name: string, x: number, y: number) =>
  page
    .getByRole('listitem')
    .filter({ hasText: name })
    .locator('img')
    .evaluate(
      async (img: HTMLImageElement, at: number[]) => {
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext('2d')!;
        context.drawImage(img, 0, 0);
        return [...context.getImageData(at[0]!, at[1]!, 1, 1).data];
      },
      [x, y],
    );

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

test('an SVG with a stated size comes out at that size, see-through in a PNG', async ({ page }) => {
  await choose(page, [sizedSvg]);
  await page.getByText('PNG', { exact: true }).click();
  await page.getByRole('button', { name: 'Change to PNG' }).click();
  await expect(page.getByRole('button', { name: 'Save sized_dtb.png' })).toBeVisible();
  expect(await thumbnailSize(page, 'sized_dtb.png')).toEqual([40, 30]);
  const [red, , , opaque] = await pixelAt(page, 'sized_dtb.png', 5, 5);
  expect(red).toBeGreaterThan(150);
  expect(opaque).toBe(255);
  expect((await pixelAt(page, 'sized_dtb.png', 35, 5))[3]).toBe(0);
});

test('an SVG with only a viewBox comes out 1024 wide, keeping its shape', async ({ page }) => {
  await choose(page, [viewBoxSvg]);
  await page.getByText('PNG', { exact: true }).click();
  await page.getByRole('button', { name: 'Change to PNG' }).click();
  await expect(page.getByRole('button', { name: 'Save viewbox-only_dtb.png' })).toBeVisible();
  expect(await thumbnailSize(page, 'viewbox-only_dtb.png')).toEqual([1024, 768]);
  // The red half is scaled with it.
  expect((await pixelAt(page, 'viewbox-only_dtb.png', 500, 700))[0]).toBeGreaterThan(150);
  expect((await pixelAt(page, 'viewbox-only_dtb.png', 520, 700))[3]).toBe(0);
});

test('an SVG with no size at all comes out 1024 wide too', async ({ page }) => {
  const bare =
    '<svg xmlns="http://www.w3.org/2000/svg"><rect width="150" height="150" fill="#00f"/></svg>';
  await choose(page, [{ name: 'bare.svg', mimeType: '', buffer: Buffer.from(bare) }]);
  await page.getByText('PNG', { exact: true }).click();
  await page.getByRole('button', { name: 'Change to PNG' }).click();
  await expect(page.getByRole('button', { name: 'Save bare_dtb.png' })).toBeVisible();
  expect(await thumbnailSize(page, 'bare_dtb.png')).toEqual([1024, 512]);
});

test('see-through parts of an SVG turn white in a JPG', async ({ page }) => {
  await choose(page, [sizedSvg]);
  await page.getByRole('button', { name: 'Change to JPG' }).click();
  await expect(page.getByRole('button', { name: 'Save sized_dtb.jpg' })).toBeVisible();
  for (const channel of await pixelAt(page, 'sized_dtb.jpg', 35, 5)) {
    expect(channel).toBeGreaterThan(245);
  }
});

test('a BMP and an AVIF change to PNG, the AVIF staying see-through', async ({ page }) => {
  await choose(page, [bmp, avif]);
  await page.getByText('PNG', { exact: true }).click();
  await page.getByRole('button', { name: 'Change to PNG' }).click();
  await expect(page.getByRole('button', { name: 'Save sample_dtb.png' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save sample_dtb_2.png' })).toBeVisible();
  for (const name of ['sample_dtb.png', 'sample_dtb_2.png']) {
    expect(await thumbnailSize(page, name)).toEqual([32, 48]);
  }
  // Which result is which depends on the order they finish, so look at both.
  const left = [
    await pixelAt(page, 'sample_dtb.png', 5, 5),
    await pixelAt(page, 'sample_dtb_2.png', 5, 5),
  ];
  for (const pixel of left) expect(pixel[0]).toBeGreaterThan(150);
  const right = [
    (await pixelAt(page, 'sample_dtb.png', 28, 5))[3]!,
    (await pixelAt(page, 'sample_dtb_2.png', 28, 5))[3]!,
  ].sort((a, b) => a - b);
  // The BMP has nothing see-through; the AVIF does.
  expect(right[0]).toBe(0);
  expect(right[1]).toBe(255);
});

test('a BMP, an AVIF and an SVG all change to JPG', async ({ page }) => {
  await choose(page, [bmp, avif, sizedSvg]);
  await page.getByRole('button', { name: 'Change to JPG' }).click();
  for (const name of ['sample_dtb.jpg', 'sample_dtb_2.jpg', 'sized_dtb.jpg']) {
    await expect(page.getByRole('button', { name: `Save ${name}` })).toBeVisible();
  }
});

test('a damaged file of a new type gets the plain failure reason', async ({ page }) => {
  await choose(page, [
    { name: 'broken.bmp', mimeType: 'image/bmp', buffer: Buffer.from('BM not really') },
    { name: 'broken.avif', mimeType: 'image/avif', buffer: Buffer.from('not really') },
    { name: 'broken.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg><oops') },
  ]);
  await page.getByRole('button', { name: 'Change to JPG' }).click();
  const failed = page
    .getByRole('listitem')
    .filter({ hasText: "Didn't work. This file may be damaged or not supported." });
  await expect(failed).toHaveCount(3);
});

test('GIF is not offered at the Choose button', async ({ page }) => {
  const accept = (await page.locator('input[type="file"]').getAttribute('accept'))!;
  expect(accept).toContain('.svg');
  expect(accept).not.toMatch(/gif/i);
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

test('the old address has a link for people without scripts, and the browser lock', async ({
  page,
}) => {
  const response = await page.request.get('photo-to-jpg/');
  const html = await response.text();
  expect(html).toMatch(/<a href="[^"]*\/change-image-type\/">/);
  expect(html).toMatch(
    /<meta http-equiv="content-security-policy" content="[^"]*default-src 'self'/i,
  );
});

/** The pictures inside a saved ICO, read by hand (not by the Site's own code). */
function readIco(bytes: Buffer) {
  expect([bytes.readUInt16LE(0), bytes.readUInt16LE(2)]).toEqual([0, 1]);
  return Array.from({ length: bytes.readUInt16LE(4) }, (_, i) => {
    const at = 6 + i * 16;
    const start = bytes.readUInt32LE(at + 12);
    const picture = PNG.sync.read(bytes.subarray(start, start + bytes.readUInt32LE(at + 8)));
    return { width: bytes[at]! || 256, height: bytes[at + 1]! || 256, picture };
  });
}

const alphaAt = ({ picture }: ReturnType<typeof readIco>[number], x: number, y: number) =>
  picture.data[(y * picture.width + x) * 4 + 3]!;

test('ICO is saved with 16, 32, 48 and 256 px pictures and no location choice', async ({
  page,
}, testInfo) => {
  // 40 × 20: the left half solid red, the right half see-through.
  const wide = new PNG({ width: 40, height: 20 });
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 20; x++) wide.data.set([255, 0, 0, 255], (y * 40 + x) * 4);
  const wideFile = testInfo.outputPath('wide.png');
  writeFileSync(wideFile, PNG.sync.write(wide));

  await page.getByText('ICO', { exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Remove location/ })).toHaveCount(0);
  await choose(page, [wideFile]);
  await page.getByRole('button', { name: 'Change to ICO' }).click();
  await expect(page.getByText('All done.', { exact: true })).toBeVisible();

  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save wide_dtb.ico' }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('wide_dtb.ico');
  const icons = readIco(readFileSync((await download.path())!));

  expect(icons.map((i) => [i.width, i.height])).toEqual([
    [16, 16],
    [32, 32],
    [48, 48],
    [256, 256],
  ]);
  for (const icon of icons) {
    expect([icon.picture.width, icon.picture.height]).toEqual([icon.width, icon.height]);
    const size = icon.width;
    // The wide image fills exactly the middle half of the rows, not stretched.
    const left = Math.round(size * 0.25);
    const top = size / 4;
    const bottom = (size * 3) / 4;
    expect(alphaAt(icon, left, top - 1)).toBe(0);
    expect(alphaAt(icon, left, top)).toBe(255);
    expect(alphaAt(icon, left, bottom - 1)).toBe(255);
    expect(alphaAt(icon, left, bottom)).toBe(0);
    // Its see-through right half stays see-through.
    expect(alphaAt(icon, Math.round(size * 0.75), size >> 1)).toBe(0);
  }
});

test('a tall photo sits in the middle of the ICO square, not stretched', async ({ page }) => {
  // Stored 48 × 32 and turned upright, so 32 × 48.
  await page.getByText('ICO', { exact: true }).click();
  await choose(page, [sample]);
  await page.getByRole('button', { name: 'Change to ICO' }).click();
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save rotated_dtb.ico' }).click();
  const icons = readIco(readFileSync((await (await saved).path())!));
  expect(icons).toHaveLength(4);
  for (const icon of icons) {
    const size = icon.width;
    // 32 × 48 is two thirds as wide as tall, so it fills the height and leaves
    // see-through at each side (at least a pixel even at 16 px).
    expect(alphaAt(icon, 0, size >> 1)).toBe(0);
    expect(alphaAt(icon, size - 1, size >> 1)).toBe(0);
    expect(alphaAt(icon, size >> 1, size >> 1)).toBe(255);
    expect(alphaAt(icon, size >> 1, 0)).toBe(255);
    expect(alphaAt(icon, size >> 1, size - 1)).toBe(255);
  }
});

test('the browser can show a saved ICO', async ({ page }) => {
  await page.getByText('ICO', { exact: true }).click();
  await choose(page, [seeThrough]);
  await page.getByRole('button', { name: 'Change to ICO' }).click();
  await expect(page.getByRole('button', { name: 'Save transparent_dtb.ico' })).toBeVisible();
  const size = await thumbnailSize(page, 'transparent_dtb.ico');
  expect(size[0]).toBeGreaterThan(0);
  expect(size[0]).toBe(size[1]);
});

test('an SVG saved as ICO is drawn sharp at each size, its see-through half staying so', async ({
  page,
}) => {
  await page.getByText('ICO', { exact: true }).click();
  await choose(page, [sizedSvg]);
  await page.getByRole('button', { name: 'Change to ICO' }).click();
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save sized_dtb.ico' }).click();
  const icons = readIco(readFileSync((await (await saved).path())!));
  expect(icons.map((i) => i.width)).toEqual([16, 32, 48, 256]);
  for (const icon of icons) {
    const size = icon.width;
    // 40 × 30 fills the width and the middle three quarters of the rows.
    const row = size >> 1;
    const left = Math.round(size * 0.25);
    expect(alphaAt(icon, left, row)).toBe(255);
    expect(icon.picture.data[(row * size + left) * 4]!).toBeGreaterThan(150);
    expect(alphaAt(icon, Math.round(size * 0.75), row)).toBe(0);
    expect(alphaAt(icon, left, 0)).toBe(0);
    expect(alphaAt(icon, left, size - 1)).toBe(0);
  }
});

test('a BMP and an AVIF save as ICO too', async ({ page }) => {
  await page.getByText('ICO', { exact: true }).click();
  await choose(page, [bmp, avif]);
  await page.getByRole('button', { name: 'Change to ICO' }).click();
  for (const name of ['sample_dtb.ico', 'sample_dtb_2.ico']) {
    await expect(page.getByRole('button', { name: `Save ${name}` })).toBeVisible();
    const size = await thumbnailSize(page, name);
    expect(size[0]).toBeGreaterThan(0);
    expect(size[0]).toBe(size[1]);
  }
});
