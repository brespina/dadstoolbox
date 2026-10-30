// Get the sound from a video end to end, in a real browser: the sound saved as an M4A,
// a video with no sound, and no need for the browser's video features.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { tool } from '../../src/tools/video-to-sound/declaration';

const folder = fileURLToPath(new URL('../../src/tools/video-to-sound/', import.meta.url));

async function choose(page: Page, files: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?videos/).click();
  await (await chooser).setFiles(files);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
    // Copying the sound needs no video features, so it works where they are missing.
    delete (window as { VideoDecoder?: unknown }).VideoDecoder;
  });
  await page.goto('video-to-sound/');
});

test('the sample video saves its sound as an M4A file', async ({ page }) => {
  await choose(page, [`${folder}sample.mp4`]);
  await page.getByRole('button', { name: tool.startButton }).click();
  await expect(page.getByText('All done.')).toBeVisible({ timeout: 20_000 });

  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save sample_dtb.m4a' }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('sample_dtb.m4a');
  const bytes = readFileSync((await download.path())!);
  // An MP4-family file: its first box is "ftyp".
  expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
});

test('a video with no sound says so plainly, with nothing to save', async ({ page }) => {
  await choose(page, [`${folder}../video-to-gif/sample.mp4`]);
  await page.getByRole('button', { name: tool.startButton }).click();
  await expect(
    page.getByText(`Didn't work. ${tool.reasons.noSound}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Save/ })).toHaveCount(0);
});
