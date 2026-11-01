// Make a QR code end to end, and the shared typed Tool page it brings: the code follows
// the typing, the saved picture reads back as the text, and too much text says why.
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { readSvgCode, savedText } from './qr-svg';

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

test('dot and corner shapes are chosen apart, start on square, and are in the saved picture', async ({
  page,
}) => {
  await box(page).fill('https://example.com/menu');
  await expect(picture(page, 'https://example.com/menu')).toBeVisible();
  await styleSection(page).click();

  const dots = page.getByRole('group', { name: 'Dot shape' });
  const corners = page.getByRole('group', { name: 'Corner shape' });
  await expect(dots.getByRole('radio')).toHaveCount(3);
  await expect(dots.locator('label').first()).toHaveText('Square');
  await expect(corners.locator('label').first()).toHaveText('Square');
  await expect(dots.getByRole('radio').first()).toBeChecked();
  await expect(corners.getByRole('radio').first()).toBeChecked();

  // The choices are separate: picking round dots leaves the corners alone.
  await dots.getByText('Round', { exact: true }).click();
  await expect(corners.getByRole('radio').first()).toBeChecked();
  await corners.getByText('Rounded', { exact: true }).click();
  await expect(dots.getByLabel('Round', { exact: true })).toBeChecked();

  const saveButton = page.getByRole('button', { name: 'Save qr-code_dtb.png' });
  await expect(async () => {
    const saved = page.waitForEvent('download');
    await saveButton.click();
    const png = PNG.sync.read(await readFile((await (await saved).path())!));
    // Rounded edges are blended: more than code and background colours.
    const colours = new Set<number>();
    for (let i = 0; i < png.data.length; i += 4) colours.add(png.data.readUInt32LE(i));
    expect(colours.size).toBeGreaterThan(2);
    const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
    expect(jsQR(rgba, png.width, png.height)?.data).toBe('https://example.com/menu');
  }).toPass();
});

test('Save as offers PNG first, and an SVG is saved that reads back and shows on the page', async ({
  page,
}) => {
  await box(page).fill('https://example.com/menu');
  await expect(picture(page, 'https://example.com/menu')).toBeVisible();
  await styleSection(page).click();

  const saveAs = page.getByRole('group', { name: 'Save as' });
  await expect(saveAs.locator('label')).toHaveText(['PNG', 'SVG']);
  await expect(saveAs.getByLabel('PNG')).toBeChecked();

  // Colours and shapes come out in the SVG too.
  await page.getByLabel('Code colour').fill('#1a237e');
  await page.getByRole('group', { name: 'Dot shape' }).getByText('Round', { exact: true }).click();
  await saveAs.getByText('SVG', { exact: true }).click();

  const saveButton = page.getByRole('button', { name: 'Save qr-code_dtb.svg' });
  await expect(saveButton).toBeVisible();
  const shown = picture(page, 'https://example.com/menu');
  await expect(shown).toBeVisible();
  // The picture is the SVG: a blob of that type that the browser has drawn.
  await expect
    .poll(() =>
      shown.evaluate(async (img: HTMLImageElement) => ({
        type: (await (await fetch(img.src)).blob()).type,
        drawn: img.complete && img.naturalWidth > 0,
      })),
    )
    .toEqual({ type: 'image/svg+xml', drawn: true });

  const saved = page.waitForEvent('download');
  await saveButton.click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('qr-code_dtb.svg');
  const svg = await savedText(download);
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  expect(svg).toContain('fill="#1a237e"');
  expect(svg).toContain('fill="#ffffff"');
  expect(await readSvgCode(page, svg)).toBe('https://example.com/menu');

  // Back to PNG: the name follows.
  await saveAs.getByText('PNG', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save qr-code_dtb.png' })).toBeVisible();
});

test('an SVG with no background has none, and still reads back on white', async ({ page }) => {
  await box(page).fill('hello');
  await styleSection(page).click();
  await page.getByLabel('No background').check();
  await page.getByRole('group', { name: 'Save as' }).getByText('SVG', { exact: true }).click();
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save qr-code_dtb.svg' }).click();
  const svg = await savedText(await saved);
  expect(svg).not.toContain('<rect');
  expect(await readSvgCode(page, svg)).toBe('hello');
});

/** A solid square PNG logo of one colour. */
function squarePng(rgb: [number, number, number]) {
  const png = new PNG({ width: 64, height: 64 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([...rgb, 255], i);
  return PNG.sync.write(png);
}

/** The colour of the middle pixel of a saved PNG, and the text it reads back as. */
async function savedPng(page: Page) {
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save qr-code_dtb.png' }).click();
  const png = PNG.sync.read(await readFile((await (await saved).path())!));
  const middle = (Math.floor(png.height / 2) * png.width + Math.floor(png.width / 2)) * 4;
  const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
  return {
    middle: [...png.data.subarray(middle, middle + 4)],
    text: jsQR(rgba, png.width, png.height)?.data,
  };
}

// The fixtures fail the test if any request leaves the Site, so the logo stays on the device.
test('a logo goes in the middle of the code, in PNG and SVG, and can be removed', async ({
  page,
}) => {
  const typed = 'https://example.com/menu';
  await box(page).fill(typed);
  await expect(picture(page, typed)).toBeVisible();
  await styleSection(page).click();

  const logo = page.getByRole('group', { name: 'Logo' });
  await expect(logo.getByRole('button', { name: 'Remove logo' })).toHaveCount(0);
  await logo.getByLabel('Choose a logo').setInputFiles({
    name: 'cafe-logo.png',
    mimeType: 'image/png',
    buffer: squarePng([200, 0, 0]),
  });
  await expect(logo.getByText('cafe-logo.png')).toBeVisible();

  // The picture follows the Style a moment later: save until it has.
  await expect(async () => {
    expect(await savedPng(page)).toEqual({ middle: [200, 0, 0, 255], text: typed });
  }).toPass();

  // Rounded dots, no background and SVG: the logo is inside the file, and it reads back.
  await page
    .getByRole('group', { name: 'Dot shape' })
    .getByText('Rounded', { exact: true })
    .click();
  await page.getByLabel('No background').check();
  await page.getByRole('group', { name: 'Save as' }).getByText('SVG', { exact: true }).click();
  const svgButton = page.getByRole('button', { name: 'Save qr-code_dtb.svg' });
  await expect(svgButton).toBeEnabled();
  const saved = page.waitForEvent('download');
  await svgButton.click();
  const svg = await savedText(await saved);
  expect(svg).toMatch(/<image [^>]*href="data:image\/png;base64,/);
  expect(svg).not.toMatch(/href="(?!data:)/);
  expect(await readSvgCode(page, svg)).toBe(typed);

  // Removed, the code is plain again.
  await page.getByRole('group', { name: 'Save as' }).getByText('PNG', { exact: true }).click();
  await page.getByLabel('No background').uncheck();
  await logo.getByRole('button', { name: 'Remove logo' }).click();
  await expect(logo.getByText('cafe-logo.png')).toHaveCount(0);
  await expect(logo.getByLabel('Choose a logo')).toBeFocused();
  await expect(async () => {
    const { middle, text } = await savedPng(page);
    expect(middle).not.toEqual([200, 0, 0, 255]);
    expect(text).toBe(typed);
  }).toPass();
});

test('an SVG logo works too, and a file that is not a picture says why', async ({ page }) => {
  await box(page).fill('hello');
  await expect(picture(page, 'hello')).toBeVisible();
  await styleSection(page).click();
  const chooseLogo = page.getByRole('group', { name: 'Logo' }).getByLabel('Choose a logo');

  const markup =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#00a000"/></svg>';
  await chooseLogo.setInputFiles({
    name: 'logo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(markup),
  });
  await expect(async () => {
    expect(await savedPng(page)).toEqual({ middle: [0, 160, 0, 255], text: 'hello' });
  }).toPass();

  await chooseLogo.setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a picture'),
  });
  const reason = "This logo didn't open. Choose a PNG, JPG, WebP or SVG.";
  await expect(page.getByText(reason).first()).toBeVisible();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(reason);
});
