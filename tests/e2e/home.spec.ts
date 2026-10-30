import { test, expect } from './fixtures';

test('home page says what the Site is', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/Dad's Toolbox/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("Dad's Toolbox");
  await expect(
    page.getByText(
      'Free tools for your files. No sign-up, no ads, and your files stay on your device.',
    ),
  ).toBeVisible();
});

test('footer links to Our promise, Report a problem and Sponsor', async ({ page }) => {
  await page.goto('./');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Our promise' })).toHaveAttribute(
    'href',
    '/dadstoolbox/promise/',
  );
  await expect(footer.getByRole('link', { name: 'Report a problem' })).toHaveAttribute(
    'href',
    'https://github.com/brespina/dadstoolbox/issues',
  );
  await expect(footer.getByRole('link', { name: 'Sponsor' })).toHaveAttribute(
    'href',
    'https://github.com/sponsors/brespina',
  );
});

test('text grows with the phone text size: body text is 18 px in rem', async ({ page }) => {
  await page.goto('./');
  const size = await page.locator('body').evaluate((body) => getComputedStyle(body).fontSize);
  expect(size).toBe('18px');
});
