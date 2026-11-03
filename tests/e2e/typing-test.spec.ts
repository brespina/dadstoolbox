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

test('a Time test ends on the clock, counted from the first key press', async ({ page }) => {
  await page.clock.install();
  await page.goto('typing-test/?seed=7');
  await page.getByRole('radio', { name: '15', exact: true }).check();
  await page.getByLabel(tool.areaLabel, { exact: true }).click();
  // Time before the first key press doesn't count.
  await page.clock.runFor(20_000);
  await expect(page.getByRole('status')).toHaveText('');

  const words = wordStream(seededRandom(7))(3);
  await page.keyboard.type(`${words.join(' ')} `);
  await page.clock.runFor(13_000);
  await expect(page.getByRole('status')).toHaveText('');
  await page.clock.runFor(2_500);

  await expect(page.getByRole('status')).toHaveText(
    /^Test done\. \d+ words per minute\. 100% right\.$/,
  );
  await expect(page.getByText('15 seconds', { exact: true })).toBeVisible();

  // The chart of speed through the test has a text alternative and a table of its numbers.
  const chart = page.getByRole('img', { name: tool.notes.chartTitle });
  await expect(chart).toBeVisible();
  await page.getByText(tool.notes.chartNumbers, { exact: true }).click();
  await expect(page.getByRole('table', { name: tool.notes.chartTitle })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(16);
});

test('Ctrl+Backspace clears the word, and a phone keyboard that sends only text works', async ({
  page,
}) => {
  await page.goto('typing-test/?seed=7');
  await page.getByRole('radio', { name: tool.notes.words, exact: true }).check();
  await page.getByRole('radio', { name: '10', exact: true }).check();
  const words = wordStream(seededRandom(7))(10);

  // Wrong letters, cleared with Ctrl+Backspace, then the first word right.
  await page.keyboard.type('qqq');
  await page.keyboard.press('Control+Backspace');
  await page.keyboard.type(`${words[0]} `);
  // A phone keyboard names no key: it sends the text, with no key press before it.
  await page.keyboard.insertText(words.slice(1).join(' '));

  await expect(page.getByRole('status')).toHaveText(
    /^Test done\. \d+ words per minute\. \d+% right\.$/,
  );
  await expect(page.getByText('10 words', { exact: true })).toBeVisible();
});

test('Punctuation and Numbers change the words of the next test, and can be combined', async ({
  page,
}) => {
  await page.goto('typing-test/?seed=7');
  await page.getByRole('radio', { name: tool.notes.words, exact: true }).check();
  await page.getByRole('radio', { name: '50', exact: true }).check();
  const shown = page.locator('.window');
  const plain = wordStream(seededRandom(7))(50);
  await expect(shown).toHaveText(plain.join(' '));

  await page.getByRole('checkbox', { name: tool.notes.punctuation }).check();
  const punctuated = wordStream(seededRandom(7), { punctuation: true })(50);
  await expect(shown).toHaveText(punctuated.join(' '));
  // Capitals after a full stop, and some commas, full stops or question marks.
  await expect(shown).toHaveText(/[.?]"? "?[A-Z]/);
  await expect(shown).toHaveText(/[,.?]/);

  await page.getByRole('checkbox', { name: tool.notes.numbers }).check();
  const both = wordStream(seededRandom(7), { punctuation: true, numbers: true })(50);
  await expect(shown).toHaveText(both.join(' '));
  await expect(shown).toHaveText(/\d/);

  // The words can still be typed, punctuation and all.
  await page.getByRole('radio', { name: '10', exact: true }).check();
  const ten = wordStream(seededRandom(7), { punctuation: true, numbers: true })(10);
  await page.keyboard.type(ten.join(' '));
  await expect(page.getByRole('status')).toHaveText(
    /^Test done\. \d+ words per minute\. 100% right\.$/,
  );
});
