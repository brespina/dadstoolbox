// Split a PDF end to end, and the shared Tool page behaviour it brings: Remove,
// per-row failures, the live region, and Save through the share sheet or a normal save.
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const samples = fileURLToPath(new URL('../../src/tools/split-pdf/', import.meta.url));
const sample = `${samples}sample.pdf`;
const locked = `${samples}sample-password.pdf`;

async function choose(page: Page, files: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Choose PDFs').click();
  await (await chooser).setFiles(files);
}

test('a locked PDF says why on its own row, and the other file carries on', async ({ page }) => {
  await page.goto('split-pdf/');
  await choose(page, [locked, sample]);
  await page.getByRole('button', { name: 'Split into pages' }).click();

  await expect(
    page.getByText("Didn't work. This PDF has a password. Remove it and try again."),
  ).toBeVisible();
  for (const name of ['sample_dtb_page1.pdf', 'sample_dtb_page2.pdf', 'sample_dtb_page3.pdf']) {
    await expect(page.getByRole('button', { name: `Save ${name}` })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Save all' })).toBeVisible();
  // One polite live region tells screen readers about each status change.
  const live = page.locator('[aria-live]');
  await expect(live).toHaveCount(1);
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await expect(live).toHaveText('sample.pdf: Done');
});

test('Remove takes a file off the waiting list', async ({ page }) => {
  await page.goto('split-pdf/');
  await choose(page, [sample]);
  await page.getByRole('button', { name: 'Remove sample.pdf' }).click();
  await expect(page.getByText('sample.pdf')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Split into pages' })).toBeDisabled();
});

test('the same file twice gives _2 names', async ({ page }) => {
  await page.goto('split-pdf/');
  await choose(page, [sample]);
  await choose(page, [sample]);
  await page.getByRole('button', { name: 'Split into pages' }).click();
  await expect(page.getByRole('button', { name: 'Save sample_dtb_page3_2.pdf' })).toBeVisible();
});

/** Replaces the share sheet with a fake that records what it was given. */
async function fakeShareSheet(page: Page, outcome: 'shared' | 'cancelled') {
  await page.addInitScript((outcome) => {
    const shared: string[][] = [];
    Object.assign(window, { shared });
    navigator.canShare = () => true;
    navigator.share = async (data?: ShareData) => {
      shared.push((data?.files ?? []).map((f) => f.name));
      if (outcome === 'cancelled') throw new DOMException('Share cancelled', 'AbortError');
    };
  }, outcome);
}

async function splitSample(page: Page) {
  await page.goto('split-pdf/');
  await choose(page, [sample]);
  await page.getByRole('button', { name: 'Split into pages' }).click();
}

test('Save opens the share sheet where the browser can share files', async ({ page }) => {
  await fakeShareSheet(page, 'shared');
  await splitSample(page);
  await page.getByRole('button', { name: 'Save sample_dtb_page2.pdf' }).click();
  await page.getByRole('button', { name: 'Save all' }).click();
  expect(await page.evaluate(() => (window as unknown as { shared: string[][] }).shared)).toEqual([
    ['sample_dtb_page2.pdf'],
    ['sample_dtb_page1.pdf', 'sample_dtb_page2.pdf', 'sample_dtb_page3.pdf'],
  ]);
});

test('a cancelled share does nothing', async ({ page }) => {
  await fakeShareSheet(page, 'cancelled');
  await splitSample(page);
  let saved = false;
  page.on('download', () => (saved = true));
  await page.getByRole('button', { name: 'Save sample_dtb_page1.pdf' }).click();
  await page.waitForTimeout(300);
  expect(saved).toBe(false);
});

test('Save falls back to a normal save where sharing files is not supported', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await splitSample(page);
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save sample_dtb_page1.pdf' }).click();
  expect((await saved).suggestedFilename()).toBe('sample_dtb_page1.pdf');
});

test('with reduced motion, progress is a still "Working…"', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('split-pdf/');
  // Hold the work so the progress area can be seen.
  await page.evaluate(() => {
    const original = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      return new Promise((resolve) => {
        (window as unknown as { release: () => void }).release = () => resolve(original.call(this));
      });
    };
  });
  await choose(page, [sample]);
  await page.getByRole('button', { name: 'Split into pages' }).click();
  await expect(page.getByRole('paragraph').filter({ hasText: /^Working…$/ })).toBeVisible();
  await expect(page.locator('progress')).toBeHidden();
  await expect(page.getByText('Working on 1 of 1…')).toBeHidden();
  await page.evaluate(() => (window as unknown as { release: () => void }).release());
  await expect(page.getByText('All done.')).toBeVisible();
});
