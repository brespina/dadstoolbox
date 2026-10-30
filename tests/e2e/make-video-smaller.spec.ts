// Make a video smaller end to end, in a real browser: the size estimate and warning
// before start, the saved video's size and sound, the Batch label, and the browser
// feature check.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { ALL_FORMATS, BufferSource, Input } from 'mediabunny';
import { test, expect } from './fixtures';
import { tool } from '../../src/tools/make-video-smaller/declaration';
import { text } from '../../src/text';

const folder = fileURLToPath(new URL('../../src/tools/make-video-smaller/', import.meta.url));
const gifFolder = fileURLToPath(new URL('../../src/tools/video-to-gif/', import.meta.url));

async function choose(page: Page, file: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?videos/).click();
  await (await chooser).setFiles(file);
}

const pick = (page: Page, size: string) => page.getByText(size, { exact: true }).click();

/** Saves the named result through a normal save, and reads what a player would find. */
async function saveVideo(page: Page, name: string) {
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: `Save ${name}` }).click({ timeout: 20_000 });
  const download = await saved;
  expect(download.suggestedFilename()).toBe(name);
  const input = new Input({
    source: new BufferSource(readFileSync((await download.path())!)),
    formats: ALL_FORMATS,
  });
  const video = await input.getPrimaryVideoTrack();
  const sound = await input.getPrimaryAudioTrack();
  return {
    picture: video && {
      codec: await video.getCodec(),
      width: await video.getDisplayWidth(),
      height: await video.getDisplayHeight(),
    },
    sound: sound ? await sound.getCodec() : null,
  };
}

test.describe('with the video features', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      navigator.canShare = () => false;
    });
    await page.goto('make-video-smaller/');
  });

  test('Smaller makes the longest side 720, with the sound kept', async ({ page }) => {
    await choose(page, `${folder}sample.mp4`);
    // A second of 1280 × 720 made 720 × 406.
    await expect(page.getByText('The video may be about 135 KB.')).toBeVisible();
    await page.getByRole('button', { name: tool.startButton }).click();
    await expect(page.locator('section.batch h2')).toHaveText(['Smaller · 1 video']);
    expect(await saveVideo(page, 'sample_dtb.mp4')).toEqual({
      picture: { codec: 'avc', width: 720, height: 406 },
      sound: 'aac',
    });
    // Made off the page, so the page stayed responsive.
    expect(page.workers().length).toBeGreaterThan(0);
  });

  test('Smallest makes the longest side 480, and the Batch says so', async ({ page }) => {
    await pick(page, 'Smallest');
    await choose(page, `${folder}sample.mp4`);
    await expect(page.getByText('The video may be about 71 KB.')).toBeVisible();
    await page.getByRole('button', { name: tool.startButton }).click();
    await expect(page.locator('section.batch h2')).toHaveText(['Smallest · 1 video']);
    expect(await saveVideo(page, 'sample_dtb.mp4')).toEqual({
      picture: { codec: 'avc', width: 480, height: 270 },
      sound: 'aac',
    });
  });

  test('a tall video stays tall, and is never made larger', async ({ page }) => {
    // Shown 360 × 640: already under 720, so Smaller keeps its size.
    await choose(page, `${gifFolder}portrait.mp4`);
    await page.getByRole('button', { name: tool.startButton }).click();
    const kept = await saveVideo(page, 'portrait_dtb.mp4');
    expect(kept.picture).toEqual({ codec: 'avc', width: 360, height: 640 });

    await pick(page, 'Smallest');
    await page.getByRole('button', { name: tool.startButton }).click();
    const smallest = await saveVideo(page, 'portrait_dtb_2.mp4');
    expect(smallest.picture).toEqual({ codec: 'avc', width: 270, height: 480 });
  });

  test('a long video warns before start that it is big, and Smallest helps', async ({ page }) => {
    // Four minutes of 1280 × 720.
    await choose(page, `${folder}long.mp4`);
    await expect(page.getByText('The video may be about 32 MB.')).toBeVisible();
    await expect(page.getByText(tool.notes.tooBig!)).toBeVisible();

    await pick(page, 'Smallest');
    await expect(page.getByText('The video may be about 17 MB.')).toBeVisible();
    await expect(page.getByText(tool.notes.tooBig!)).toHaveCount(0);
  });
});

test.describe('without a video maker', () => {
  test.beforeEach(async ({ page }) => {
    // As on a browser that can read video but not make it.
    await page.addInitScript(() => {
      delete (window as { VideoEncoder?: unknown }).VideoEncoder;
    });
  });

  test('the Tool page says so, with Choose greyed out', async ({ page }) => {
    await page.goto('make-video-smaller/');
    await expect(page.getByText(text.tool.unsupported)).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeDisabled();
    await expect(page.getByRole('button', { name: tool.startButton })).toBeDisabled();
  });
});
