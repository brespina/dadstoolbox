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

const styleSection = (page: Page) => page.locator('summary', { hasText: 'Style' });

test('the Style section opens by keyboard, and its colours are in the saved picture', async ({
  page,
}) => {
  const codeColour = page.getByLabel('Code colour');
  await expect(codeColour).toBeHidden();
  await box(page).fill('hello');
  await expect(picture(page, 'hello')).toBeVisible();

  await styleSection(page).focus();
  await page.keyboard.press('Enter');
  await expect(codeColour).toBeVisible();
  await codeColour.fill('#1a237e');
  await page.getByLabel('Background colour').fill('#fff59d');

  // The picture follows the Style a moment later: save until it has.
  const saveButton = page.getByRole('button', { name: 'Save qr-code_dtb.png' });
  await expect(async () => {
    const saved = page.waitForEvent('download');
    await saveButton.click();
    const png = PNG.sync.read(await readFile((await (await saved).path())!));
    expect([...png.data.subarray(0, 4)]).toEqual([255, 245, 157, 255]);
    const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
    expect(jsQR(rgba, png.width, png.height)?.data).toBe('hello');
  }).toPass();
});

test('close colours and no background warn, but the code is still made', async ({ page }) => {
  await box(page).fill('hello');
  await expect(picture(page, 'hello')).toBeVisible();
  await styleSection(page).click();
  const warning = 'These colours may not scan.';
  const note = 'Put this on a light background so phones can read it.';
  const live = page.locator('[aria-live="polite"]');

  await page.getByLabel('Code colour').fill('#ffeb3b');
  await expect(page.getByText(warning, { exact: true }).first()).toBeVisible();
  await expect(live).toHaveText(warning);
  await expect(picture(page, 'hello')).toBeVisible();

  await page.getByLabel('Code colour').fill('#000000');
  await expect(page.getByText(warning, { exact: true })).toHaveCount(0);
  await page.getByLabel('No background').check();
  await expect(page.getByLabel('Background colour')).toBeDisabled();
  await expect(page.getByText(note, { exact: true }).first()).toBeVisible();
  await expect(live).toHaveText(note);
  await expect(picture(page, 'hello')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save qr-code_dtb.png' })).toBeEnabled();
});
