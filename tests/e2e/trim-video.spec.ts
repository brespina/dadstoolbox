// Trim a video end to end, in a real browser: Start and End set through each video's
// preview, the saved clip's length and sound, and End not after Start held back.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { ALL_FORMATS, BufferSource, Input } from 'mediabunny';
import { test, expect } from './fixtures';
import { tool } from '../../src/tools/trim-video/declaration';

// One second of 320 × 180 picture with AAC sound.
const sample = fileURLToPath(new URL('../../src/tools/trim-video/sample.mov', import.meta.url));
// A minute long, so the clip takes long enough to show progress.
const long = fileURLToPath(new URL('../../src/tools/video-to-gif/long.mp4', import.meta.url));

async function choose(page: Page, files: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/Choose (more )?videos/).click();
  await (await chooser).setFiles(files);
}

/** Pauses the nth preview at `seconds`, then presses Set Start or Set End. */
async function setAt(page: Page, n: number, which: 'Start' | 'End', seconds: number) {
  const preview = page.locator('video').nth(n);
  await preview.evaluate(
    (video: HTMLVideoElement, at) =>
      new Promise((resolve) => {
        const seek = () => {
          video.addEventListener('seeked', resolve, { once: true });
          video.currentTime = at;
        };
        if (video.readyState >= 1) seek();
        else video.addEventListener('loadedmetadata', seek, { once: true });
      }),
    seconds,
  );
  await page
    .getByRole('button', { name: new RegExp(`^Set ${which} to now for`) })
    .nth(n)
    .click();
}

/** Saves the named result through a normal save, and reads its length and sound. */
async function saveClip(page: Page, name: string) {
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
    width: await video!.getDisplayWidth(),
    seconds: await input.computeDuration(),
    sound: sound ? await sound.getCodec() : null,
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await page.goto('trim-video/');
});

test('Start and End set through the preview give a clip that long, with its sound', async ({
  page,
}) => {
  await choose(page, [sample]);
  await setAt(page, 0, 'Start', 0.2);
  await setAt(page, 0, 'End', 0.6);
  await expect(page.getByText('Start: 0:00.2')).toBeVisible();
  await expect(page.getByText('End: 0:00.6')).toBeVisible();
  await expect(page.getByText('The clip will be 0:00.4 long.')).toBeVisible();
  await page.getByRole('button', { name: tool.startButton }).click();
  await expect(page.getByText(tool.allDone)).toBeVisible({ timeout: 20_000 });
  // Made off the page, so the page stayed responsive.
  expect(page.workers().length).toBeGreaterThan(0);
  const clip = await saveClip(page, 'sample_dtb.mp4');
  // Within a frame or two: copied sound ends on its own small steps.
  expect(clip.seconds).toBeGreaterThan(0.4 - 0.07);
  expect(clip.seconds).toBeLessThan(0.4 + 0.07);
  expect(clip).toMatchObject({ width: 320, sound: 'aac' });
});

test('a long clip shows a rising percentage', async ({ page }) => {
  // Note every percent the page shows, however briefly.
  await page.evaluate(() => {
    const seen: number[] = [];
    (window as unknown as { seen: number[] }).seen = seen;
    new MutationObserver(() => {
      for (const match of document.body.textContent!.matchAll(/Working… (\d+)%/g)) {
        const percent = Number(match[1]);
        if (!seen.includes(percent)) seen.push(percent);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  // Start and End left as they are: the whole minute.
  await choose(page, [long]);
  await page.getByRole('button', { name: tool.startButton }).click();
  await expect(page.getByText(tool.allDone)).toBeVisible({ timeout: 60_000 });
  const seen = await page.evaluate(() => (window as unknown as { seen: number[] }).seen);
  expect(seen.length).toBeGreaterThan(3);
  expect(seen).toEqual([...seen].sort((a, b) => a - b));
});

test('two videos keep their own Start and End', async ({ page }) => {
  await choose(page, [sample, sample]);
  await expect(page.locator('video')).toHaveCount(2);
  await setAt(page, 0, 'End', 0.3);
  await setAt(page, 1, 'Start', 0.5);
  await page.getByRole('button', { name: tool.startButton }).click();
  const first = await saveClip(page, 'sample_dtb.mp4');
  const second = await saveClip(page, 'sample_dtb_2.mp4');
  expect(Math.abs(first.seconds - 0.3)).toBeLessThan(0.07);
  expect(Math.abs(second.seconds - 0.5)).toBeLessThan(0.07);
});

test('End not after Start is refused in plain words before start', async ({ page }) => {
  await choose(page, [sample]);
  await setAt(page, 0, 'End', 0.3);
  await setAt(page, 0, 'Start', 0.6);
  await expect(page.getByText(tool.reasons.endBeforeStart!, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: tool.startButton })).toBeDisabled();
  // Moving End later fixes it.
  await setAt(page, 0, 'End', 0.9);
  await expect(page.getByText(tool.reasons.endBeforeStart!, { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: tool.startButton })).toBeEnabled();
});

test('Start and End can be set one-handed: every button at least 44 px', async ({ page }) => {
  await choose(page, [sample]);
  await expect(page.getByText('Start: 0:00.0')).toBeVisible();
  for (const name of [/^Set Start to now for/, /^Set End to now for/]) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
});
