// Make a Wi-Fi QR code end to end: two fields and no type box, the code follows the
// fields, the picture's description leaves out the password, and the saved picture
// reads back as the network.
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { test, expect } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await page.goto('wifi-qr-code/');
});

test('the code follows the fields, and the saved picture joins the network', async ({ page }) => {
  await expect(page.getByRole('textbox')).toHaveCount(2);
  await expect(page.getByLabel('Type here')).toHaveCount(0);

  await page.getByLabel('Network name', { exact: true }).fill('Garden');
  await expect(page.getByRole('img', { name: 'Wi-Fi QR code for Garden' })).toBeVisible();
  await page.getByLabel('Network name', { exact: true }).pressSequentially(' Shed');
  await page.getByLabel('Password', { exact: true }).fill('tomatoes42');
  const picture = page.getByRole('img', { name: 'Wi-Fi QR code for Garden Shed' });
  await expect(picture).toBeVisible();
  await expect(page.getByRole('button', { name: /^Save / })).toBeEnabled();

  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save wifi-qr-code_dtb.png' }).click();
  const download = await saved;
  const png = PNG.sync.read(await readFile((await download.path())!));
  const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
  expect(jsQR(rgba, png.width, png.height)?.data).toBe('WIFI:T:WPA;S:Garden Shed;P:tomatoes42;;');
});

test('an empty network name shows no code and no reason', async ({ page }) => {
  await page.getByLabel('Password', { exact: true }).fill('secret');
  await page.getByLabel('Network name', { exact: true }).fill('Home');
  await expect(page.getByRole('img')).toBeVisible();
  await page.getByLabel('Network name', { exact: true }).fill('');
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Save / })).toHaveCount(0);
  await expect(page.locator('.failed')).toHaveCount(0);
});
