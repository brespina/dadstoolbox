// Make a QR code end to end, and the shared typed Tool page it brings: the code follows
// the typing, the saved picture reads back as the text, and too much text says why.
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const box = (page: Page) => page.getByLabel('Text or web address');
const picture = (page: Page, typed: string) =>
  page.getByRole('img', { name: `QR code that says: ${typed}` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await page.goto('qr-code/');
});

test('the code follows the typing, and the saved picture reads back', async ({ page }) => {
  await box(page).fill('https://example.com');
  await expect(picture(page, 'https://example.com')).toBeVisible();
  await box(page).pressSequentially('/menu');
  await expect(picture(page, 'https://example.com/menu')).toBeVisible();

  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save qr-code_dtb.png' }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('qr-code_dtb.png');
  const png = PNG.sync.read(await readFile((await download.path())!));
  const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
  expect(jsQR(rgba, png.width, png.height)?.data).toBe('https://example.com/menu');
});

test('an empty box shows no code and no reason', async ({ page }) => {
  await box(page).fill('hello');
  await expect(picture(page, 'hello')).toBeVisible();
  await box(page).fill('');
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Save / })).toHaveCount(0);
});

test('too much text says why, politely', async ({ page }) => {
  await box(page).fill('a'.repeat(5000));
  const reason = 'This is too long for one code. Try a shorter text.';
  await expect(page.getByText(reason).first()).toBeVisible();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(reason);
  await expect(page.getByRole('img')).toHaveCount(0);
});
