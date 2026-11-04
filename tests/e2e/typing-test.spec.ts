// Typing test: a short Words test, typed from start to finish. `?seed=` in the address
// makes the page draw the same words as the generator does here.
import { test, expect } from './fixtures';
import { seededRandom } from '../../src/practice/random';
import { wordStream } from '../../src/tools/typing-test/words';
import { text } from '../../src/text';
import { tool } from '../../src/tools/typing-test/declaration';
import { locate } from '../../src/tools/typing-test/layouts';

test('type a 10-word test, see the results, and restart with Tab then Enter', async ({ page }) => {
  await page.goto('typing-test/?seed=7');
  await page.getByRole('radio', { name: tool.notes.words, exact: true }).check();
  await page.getByRole('radio', { name: '10', exact: true }).check();
  await expect(page.getByText(text.practice.start)).toBeVisible();

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

// The phone projects are touch-only devices, which don't offer a Layout. These tests act as
// a computer with a mouse instead.
test.describe('Layouts, on a computer with a mouse', () => {
  test.use({ isMobile: false, hasTouch: false, viewport: { width: 1000, height: 800 } });

  // The keys of a US board in reading order, and what each Layout types on them.
  const qwerty = 'qwertyuiopasdfghjkl;zxcvbnm,./';
  const colemak = 'qwfpgjluy;arstdhneiozxcvbkm,./';
  const dvorak = "',.pyfgcrlaoeuidhtns;qjkxbmwvz";
  const punctuation: Record<string, string> = {
    ';': 'Semicolon',
    ',': 'Comma',
    '.': 'Period',
    '/': 'Slash',
  };
  /** The physical key to press so that `layout` types `char`. */
  const keyFor = (layout: string, char: string) => {
    if (char === ' ') return 'Space';
    const place = qwerty[layout.indexOf(char)]!;
    return punctuation[place] ?? `Key${place.toUpperCase()}`;
  };

  test('pressing physical keys with Colemak chosen scores the remapped letters', async ({
    page,
  }) => {
    await page.goto('typing-test/?seed=7');
    await page.getByRole('radio', { name: 'Colemak', exact: true }).check();
    await page.getByRole('radio', { name: tool.notes.words, exact: true }).check();
    await page.getByRole('radio', { name: '10', exact: true }).check();
    const words = wordStream(seededRandom(7))(10);

    await page.getByLabel(tool.areaLabel, { exact: true }).click();
    for (const char of words.join(' ')) await page.keyboard.press(keyFor(colemak, char));

    await expect(page.getByRole('status')).toHaveText(
      /^Test done\. \d+ words per minute\. 100% right\.$/,
    );
  });

  test('the on-screen keyboard shows the chosen Layout and lights the next key', async ({
    page,
  }) => {
    await page.goto('typing-test/?seed=7');
    const [first] = wordStream(seededRandom(7))(50);
    await expect(page.locator('.keyboard')).toHaveCount(0);

    await page.getByRole('radio', { name: 'Dvorak', exact: true }).check();
    const keyboard = page.locator('.keyboard');
    await expect(keyboard).toHaveAttribute('aria-hidden', 'true');
    // Dvorak's home row, where QWERTY has ASDF.
    await expect(keyboard).toContainText(/aoeuidhtns/i);
    const lit = keyboard.locator('.key.lit');
    await expect(lit).toHaveCount(1);
    await expect(lit).toHaveText(first![0]!, { ignoreCase: true });

    // The light moves on to the next letter of the word once the first one is typed.
    await page.getByLabel(tool.areaLabel, { exact: true }).click();
    await page.keyboard.press(keyFor(dvorak, first![0]!));
    await expect(lit).toHaveText(first![1] ?? '', { ignoreCase: true });
  });

  test('capitals, punctuation and digits are typed with Shift where the Layout puts them', async ({
    page,
  }) => {
    await page.goto('typing-test/?seed=7');
    await page.getByRole('radio', { name: 'Programmer Dvorak', exact: true }).check();
    await page.getByRole('checkbox', { name: tool.notes.punctuation }).check();
    await page.getByRole('checkbox', { name: tool.notes.numbers }).check();
    await page.getByRole('radio', { name: tool.notes.words, exact: true }).check();
    await page.getByRole('radio', { name: '50', exact: true }).check();
    const words = wordStream(seededRandom(7), { punctuation: true, numbers: true })(50).join(' ');
    // The words have the characters that need Shift on this board.
    expect(words).toMatch(/[A-Z]/);
    expect(words).toMatch(/\d/);

    await page.getByLabel(tool.areaLabel, { exact: true }).click();
    for (const char of words) {
      const key = locate('programmer-dvorak', char)!;
      await page.keyboard.press(key.shift ? `Shift+${key.code}` : key.code);
    }

    await expect(page.getByRole('status')).toHaveText(
      /^Test done\. \d+ words per minute\. 100% right\.$/,
    );
  });
});

test('the settings bar fades while typing, stands still, and comes back on focus', async ({
  page,
}) => {
  await page.goto('typing-test/?seed=7');
  const settings = page.locator('.settings');
  await expect(page.getByText(text.practice.start)).toBeVisible();
  // Page tests run with reduced motion (fixtures.ts): no fade and no blinking caret.
  await expect(settings).toHaveCSS('transition-duration', '0s');
  await expect(page.locator('.caret')).toHaveCSS('animation-name', 'none');

  await page.getByLabel(tool.areaLabel, { exact: true }).focus();
  await page.keyboard.press('x');
  await expect(settings).toHaveCSS('opacity', '0');
  // A keyboard user can still reach the settings, and they show again.
  await page.getByRole('checkbox', { name: tool.notes.numbers }).focus();
  await expect(settings).toHaveCSS('opacity', '1');
});

test('a touch-only device offers no Layout and no keyboard picture', async ({ page }) => {
  await page.goto('typing-test/');
  await expect(page.getByRole('radio', { name: tool.notes.words, exact: true })).toBeVisible();
  await expect(page.getByText(tool.notes.layout, { exact: true })).toHaveCount(0);
  await expect(page.locator('.keyboard')).toHaveCount(0);
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
