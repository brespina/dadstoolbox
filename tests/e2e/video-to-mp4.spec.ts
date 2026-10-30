// Make a video play anywhere (MP4) end to end, in a real browser: the saved MP4's
// picture and sound, the plain reasons, and the "making video" browser feature check.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { ALL_FORMATS, BufferSource, Input } from 'mediabunny';
import { test, expect } from './fixtures';
import { tool } from '../../src/tools/video-to-mp4/declaration';
import { text } from '../../src/text';

const folder = fileURLToPath(new URL('../../src/tools/video-to-mp4/', import.meta.url));
const gifFolder = fileURLToPath(new URL('../../src/tools/video-to-gif/', import.meta.url));

async function make(page: Page, file: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?videos/).click();
  await (await chooser).setFiles(file);
  await page.getByRole('button', { name: tool.startButton }).click();
}

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
    kind: (await input.getFormat()).name,
    picture: video && {
      codec: await video.getCodec(),
      width: await video.getDisplayWidth(),
      height: await video.getDisplayHeight(),
      // Turned the right way up in the picture, not by a note a player may ignore.
      rotation: await video.getRotation(),
    },
    sound: sound ? await sound.getCodec() : null,
    seconds: Math.round(await input.computeDuration()),
  };
}

const failedWith = (page: Page, reason: string) =>
  page.getByText(`Didn't work. ${reason}`, { exact: true });

test.describe('with the video features', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      navigator.canShare = () => false;
    });
    await page.goto('video-to-mp4/');
  });

  test('an iPhone-style .mov saves as an H.264 MP4, same size, with its sound', async ({
    page,
  }) => {
    await make(page, `${folder}sample.mov`);
    await expect(page.getByText(tool.allDone)).toBeVisible({ timeout: 20_000 });
    // Made off the page, so the page stayed responsive.
    expect(page.workers().length).toBeGreaterThan(0);
    expect(await saveVideo(page, 'sample_dtb.mp4')).toEqual({
      kind: 'MP4',
      picture: { codec: 'avc', width: 320, height: 180, rotation: 0 },
      sound: 'aac',
      seconds: 1,
    });
  });

  test('a turned video stays the right way up', async ({ page }) => {
    // Stored 640 × 360 and marked to be shown turned a quarter turn.
    await make(page, `${gifFolder}portrait.mp4`);
    const saved = await saveVideo(page, 'portrait_dtb.mp4');
    expect(saved.picture).toEqual({ codec: 'avc', width: 360, height: 640, rotation: 0 });
  });

  test('an iPhone HEVC video saves as H.264 where the browser can read it', async ({
    page,
    browserName,
  }) => {
    // Chromium here can't read HEVC (an iPhone format); WebKit can.
    test.skip(browserName === 'chromium', 'Chromium here cannot read HEVC');
    await make(page, `${folder}hevc.mov`);
    expect(await saveVideo(page, 'hevc_dtb.mp4')).toMatchObject({
      picture: { codec: 'avc', width: 320, height: 180 },
      sound: 'aac',
    });
  });

  test('a video this browser cannot read says so plainly', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Only Chromium here cannot read HEVC');
    await make(page, `${folder}hevc.mov`);
    await expect(failedWith(page, tool.reasons.cantMake!)).toBeVisible({ timeout: 20_000 });
  });

  test('sound that is not AAC is remade as AAC where the browser can', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'chromium', 'Chromium here cannot make AAC sound');
    await make(page, `${folder}opus.mp4`);
    expect(await saveVideo(page, 'opus_dtb.mp4')).toMatchObject({
      picture: { codec: 'avc', width: 320, height: 180 },
      sound: 'aac',
    });
  });

  test('sound the browser cannot keep fails plainly, never a silent video', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Only Chromium here cannot make AAC sound');
    await make(page, `${folder}opus.mp4`);
    await expect(failedWith(page, tool.reasons.cantKeepSound!)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Save / })).toHaveCount(0);
  });

  test('a file that is not a video says so plainly', async ({ page }, testInfo) => {
    const notVideo = testInfo.outputPath('notes.mp4');
    writeFileSync(notVideo, 'just some words');
    await make(page, notVideo);
    await expect(failedWith(page, tool.reasons.notVideo!)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('without a video maker', () => {
  test.beforeEach(async ({ page }) => {
    // As on a browser that can read video but not make it.
    await page.addInitScript(() => {
      delete (window as { VideoEncoder?: unknown }).VideoEncoder;
    });
  });

  test('the home page row says it does not work on this browser yet', async ({ page }) => {
    await page.goto('./');
    const row = page.getByRole('link', { name: new RegExp(tool.name.replace(/[()]/g, '\\$&')) });
    await expect(row).toContainText(text.tool.unsupported);
    await expect(row).not.toContainText(tool.blurb);
  });

  test('the Tool page says so, with Choose greyed out', async ({ page }) => {
    await page.goto('video-to-mp4/');
    await expect(page.getByText(text.tool.unsupported)).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeDisabled();
    await expect(page.getByRole('button', { name: tool.startButton })).toBeDisabled();
  });
});
