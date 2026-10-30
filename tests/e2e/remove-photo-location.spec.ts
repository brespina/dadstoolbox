// Remove photo location end to end for an iPhone photo (HEIC): it is accepted, and
// saves as a HEIC with the same name ending. The JPG path is the generated test.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readDetails } from '../../src/photos/exif';
import { test, expect } from './fixtures';

// An iPhone photo (HEIC) with a date taken and a location.
const iphone = fileURLToPath(
  new URL('../../src/tools/remove-photo-location/iphone.heic', import.meta.url),
);

test('an iPhone photo (HEIC) saves as a HEIC with no location', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await page.goto('remove-photo-location/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Choose photos').click();
  await (await chooser).setFiles([iphone]);
  await page.getByRole('button', { name: /^Remove location/ }).click();
  await expect(page.getByText('All done. Location data removed.')).toBeVisible();

  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save iphone_dtb.heic' }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('iphone_dtb.heic');
  const bytes = new Uint8Array(readFileSync((await download.path())!));
  const original = new Uint8Array(readFileSync(iphone));
  expect(bytes.length).toBe(original.length);
  expect(readDetails(original)?.location).not.toEqual([]);
  expect(readDetails(bytes)?.location).toEqual([]);
  expect(readDetails(bytes)?.dates).toEqual(readDetails(original)?.dates);
});
