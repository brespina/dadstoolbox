import { test, expect } from './fixtures';

test('Our promise page shows its four sections', async ({ page }) => {
  await page.goto('promise/');
  await expect(page).toHaveTitle(/Our promise/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Our promise');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'The promise',
    'How it works',
    'Check for yourself',
    'Free and open',
  ]);
  await expect(page.getByText('Your phone or computer does all the work.')).toBeVisible();
  await expect(
    page.getByText(/turn on airplane mode and try again\. It still works\./),
  ).toBeVisible();
  await expect(
    page.getByText('Each page tells your browser it may only talk to this Site.', {
      exact: false,
    }),
  ).toBeVisible();
});

test('Our promise page never calls itself a privacy policy', async ({ page }) => {
  await page.goto('promise/');
  await expect(page.locator('body')).not.toContainText(/privacy policy/i);
});

test('Free and open links the code, Report a problem and GitHub privacy', async ({ page }) => {
  await page.goto('promise/');
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: 'See the code on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/brespina/dadstoolbox',
  );
  await expect(main.getByRole('link', { name: 'Report a problem' })).toHaveAttribute(
    'href',
    'https://github.com/brespina/dadstoolbox/issues',
  );
  await expect(main.getByRole('link', { name: /privacy statement/i })).toHaveAttribute(
    'href',
    'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
  );
  await expect(
    main.getByText(
      "The Site is hosted by GitHub. Like any website host, GitHub may keep basic visit records for security. We can't see them and don't use them.",
      { exact: false },
    ),
  ).toBeVisible();
});

for (const path of ['./', 'promise/']) {
  test(`footer on ${path} reaches Our promise`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole('contentinfo').getByRole('link', { name: 'Our promise' }).click();
    await expect(page).toHaveURL(/\/dadstoolbox\/promise\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Our promise');
  });
}
