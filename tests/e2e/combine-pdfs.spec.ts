// Combine PDFs end to end, and the shared ↑ / ↓ buttons of "all files together".
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const samples = fileURLToPath(new URL('../../src/tools/combine-pdfs/', import.meta.url));
// sample.pdf has two pages 200 wide; sample-2.pdf one page 400 wide.
const first = `${samples}sample.pdf`;
const second = `${samples}sample-2.pdf`;
const locked = `${samples}sample-password.pdf`;

async function choose(page: Page, files: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Choose PDFs').click();
  await (await chooser).setFiles(files);
}

const waitingNames = (page: Page) =>
  page.getByRole('region', { name: 'Ready to start' }).getByRole('listitem').locator('.file-name');

test('↑ / ↓ set the order, and the combined PDF follows it', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await page.goto('combine-pdfs/');
  await choose(page, [first, second]);

  // The first file can't go up and the last can't go down.
  await expect(page.getByRole('button', { name: 'Move sample.pdf up' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Move sample-2.pdf down' })).toBeDisabled();

  // With the keyboard, focus stays on the moved file's buttons.
  await page.getByRole('button', { name: 'Move sample-2.pdf up' }).focus();
  await page.keyboard.press('Enter');
  await expect(waitingNames(page)).toHaveText(['sample-2.pdf', 'sample.pdf']);
  await expect(page.getByRole('button', { name: 'Move sample-2.pdf down' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(waitingNames(page)).toHaveText(['sample.pdf', 'sample-2.pdf']);
  await expect(page.getByRole('button', { name: 'Move sample-2.pdf up' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(waitingNames(page)).toHaveText(['sample-2.pdf', 'sample.pdf']);

  await page.getByRole('button', { name: 'Combine PDFs' }).click();
  await expect(page.getByText('sample-2.pdf, sample.pdf', { exact: true })).toBeVisible();
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save combined_dtb.pdf' }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('combined_dtb.pdf');

  const combined = await PDFDocument.load(await readFile(await download.path()));
  expect(combined.getPages().map((p) => p.getWidth())).toEqual([400, 200, 200]);
});

test('↑ / ↓ buttons are at least 44 × 44', async ({ page }) => {
  await page.goto('combine-pdfs/');
  await choose(page, [first, second]);
  for (const name of ['Move sample.pdf down', 'Move sample-2.pdf up']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test('a PDF with a password fails the combined PDF with the plain reason', async ({ page }) => {
  await page.goto('combine-pdfs/');
  await choose(page, [first, locked]);
  await page.getByRole('button', { name: 'Combine PDFs' }).click();
  await expect(
    page.getByText(
      "Didn't work. sample-password.pdf: This PDF has a password. Remove it and try again.",
      { exact: true },
    ),
  ).toBeVisible();
});

test('combining again gives combined_dtb_2.pdf', async ({ page }) => {
  await page.goto('combine-pdfs/');
  await choose(page, [first, second]);
  await page.getByRole('button', { name: 'Combine PDFs' }).click();
  await expect(page.getByRole('button', { name: 'Save combined_dtb.pdf' })).toBeVisible();
  await choose(page, [second]);
  await page.getByRole('button', { name: 'Combine PDFs' }).click();
  await expect(page.getByRole('button', { name: 'Save combined_dtb_2.pdf' })).toBeVisible();
});
