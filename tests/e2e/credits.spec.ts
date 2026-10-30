import { test, expect } from './fixtures';

test('Our promise links to the credits', async ({ page }) => {
  await page.goto('promise/');
  await page.getByRole('main').getByRole('link', { name: 'Free code we use' }).click();
  await expect(page).toHaveURL(/\/dadstoolbox\/credits\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Free code we use');
});

test('credits name each library with its license, code and license text', async ({ page }) => {
  await page.goto('credits/');
  const main = page.getByRole('main');
  const names = [
    'pdf-lib',
    'qrcode',
    'heic-to',
    'libheif',
    'libde265',
    'Mediabunny',
    'gifenc',
    'Comlink',
    'Svelte',
    'Astro',
  ];
  for (const name of names) {
    const item = main.getByRole('listitem').filter({
      has: page.getByRole('heading', { name, exact: true }),
    });
    await expect(item).toHaveCount(1);
    await expect(item.getByRole('link', { name: `${name} code` })).toHaveAttribute(
      'href',
      /^https:\/\//,
    );
    await expect(item.getByRole('link', { name: `${name} license` })).toHaveAttribute(
      'href',
      /^https:\/\//,
    );
  }
  const mediabunny = main.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Mediabunny', exact: true }),
  });
  await expect(mediabunny).toContainText('MPL-2.0');
});

test("libheif's credit links its source and its LGPL license", async ({ page }) => {
  await page.goto('credits/');
  const libheif = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'libheif', exact: true }),
  });
  await expect(libheif).toContainText('LGPL-3.0');
  await expect(libheif.getByRole('link', { name: 'libheif code' })).toHaveAttribute(
    'href',
    'https://github.com/strukturag/libheif/tree/v1.23.7',
  );
});
