// Typing test: a short Words test, typed from start to finish. `?seed=` in the address
// makes the page draw the same words as the generator does here.
import { test, expect } from './fixtures';
import { seededRandom } from '../../src/practice/random';
import { wordStream } from '../../src/tools/typing-test/words';
import { tool } from '../../src/tools/typing-test/declaration';

test('type a 10-word test, see the results, and restart with Tab then Enter', async ({ page }) => {
  await page.goto('typing-test/?seed=7');
  await page.getByRole('radio', { name: tool.notes.words, exact: true }).check();
  await page.getByRole('radio', { name: '10', exact: true }).check();
  await expect(page.getByText(tool.notes.start)).toBeVisible();

  // No click first: the first key press starts the test.
  const words = wordStream(seededRandom(7))(10);
  await page.keyboard.type(words.join(' '));

  await expect(page.getByRole('status')).toHaveText(
    /^Test done\. \d+ words per minute\. 100% right\.$/,
  );
  await expect(page.getByText(tool.notes.accuracy, { exact: true })).toBeVisible();
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await expect(page.getByText('10 words', { exact: true })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: tool.notes.restart })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText(tool.notes.accuracy, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel(tool.areaLabel, { exact: true })).toBeFocused();
});
