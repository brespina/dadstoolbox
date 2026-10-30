// Make a gif from a video end to end, in a real browser: the size estimate and warning
// before start, the frames read by the browser's own video features in a worker, and
// the browser feature check.
import { closeSync, openSync, readFileSync, ftruncateSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { tool } from '../../src/tools/video-to-gif/declaration';
import { text } from '../../src/text';

const folder = fileURLToPath(new URL('../../src/tools/video-to-gif/', import.meta.url));

async function choose(page: Page, files: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?videos/).click();
  await (await chooser).setFiles(files);
}

/** Saves the named result through a normal save, and reads its width and height. */
async function saveGif(page: Page, name: string) {
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: `Save ${name}` }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe(name);
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 6).toString()).toBe('GIF89a');
  return [bytes.readUInt16LE(6), bytes.readUInt16LE(8)];
}

test.describe('with the video features', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      navigator.canShare = () => false;
    });
    await page.goto('video-to-gif/');
  });

  test('the sample becomes a gif 480 px wide, made in a worker', async ({ page }) => {
    await choose(page, [`${folder}sample.mp4`]);
    // Half a second of 1280 × 720: 5 frames of 480 × 270.
    await expect(page.getByText('The gif will be about 233 KB.')).toBeVisible();
    await page.getByRole('button', { name: 'Make a gif' }).click();
    await expect(page.getByText('All done.')).toBeVisible({ timeout: 20_000 });
    // The gif was made off the page, so the page stayed responsive.
    expect(page.workers().length).toBeGreaterThan(0);
    expect(await saveGif(page, 'sample_dtb.gif')).toEqual([480, 270]);
  });

  test('a tall video stays tall, with its longest side 480 px', async ({ page }) => {
    // Stored 640 × 360 and marked to be shown turned a quarter turn.
    await choose(page, [`${folder}portrait.mp4`]);
    await page.getByRole('button', { name: 'Make a gif' }).click();
    expect(await saveGif(page, 'portrait_dtb.gif')).toEqual([270, 480]);
  });

  test('a long video warns before start that the gif is big, and Small helps', async ({ page }) => {
    await choose(page, [`${folder}long.mp4`]);
    await expect(page.getByText('The gif will be about 28 MB.')).toBeVisible();
    await expect(page.getByText(tool.notes.tooBig!)).toBeVisible();

    await page.getByText('Small', { exact: true }).click();
    await expect(page.getByText('The gif will be about 12 MB.')).toBeVisible();
    await expect(page.getByText(tool.notes.tooBig!)).toHaveCount(0);
  });

  test('a big file gets the large-file note on its Ready row', async ({ page }, testInfo) => {
    // Just over the limit. The note shows before start, so it needn't be a real video.
    const big = testInfo.outputPath('big.mp4');
    const handle = openSync(big, 'w');
    ftruncateSync(handle, tool.largeFileLimit + 1);
    closeSync(handle);
    await choose(page, [big]);
    await expect(page.getByText(tool.largeFileNote)).toBeVisible();
  });

  test('a video this browser cannot open says so plainly', async ({ page, browserName }) => {
    // Chromium here has no HEVC (an iPhone format); WebKit may.
    test.skip(browserName !== 'chromium', 'HEVC opens in some browsers');
    await choose(page, [`${folder}hevc.mp4`]);
    await page.getByRole('button', { name: 'Make a gif' }).click();
    await expect(
      page.getByText(`Didn't work. ${tool.reasons.cantOpen}`, { exact: true }),
    ).toBeVisible();
  });
});

test.describe('without the video features', () => {
  test.beforeEach(async ({ page }) => {
    // As on Firefox for Android.
    await page.addInitScript(() => {
      delete (window as { VideoDecoder?: unknown }).VideoDecoder;
    });
  });

  test('the home page row says it does not work on this browser yet', async ({ page }) => {
    await page.goto('./');
    const row = page.getByRole('link', { name: new RegExp(tool.name) });
    await expect(row).toContainText(text.tool.unsupported);
    await expect(row).not.toContainText(tool.blurb);
  });

  test('the Tool page says so, with Choose greyed out', async ({ page }) => {
    await page.goto('video-to-gif/');
    await expect(page.getByText(text.tool.unsupported)).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Make a gif' })).toBeDisabled();
  });
});
