// Vim practice: a round of Drills in Lesson 1, played with h j k l. `?seed=` in the
// address makes the page draw the same Drills as `newRound` does here.
import { test, expect } from './fixtures';
import { seededRandom } from '../../src/practice/random';
import { newRound, type Drill } from '../../src/tools/vim-practice/round';
import { tool } from '../../src/tools/vim-practice/declaration';

/** Keys that take a Drill's cursor to its target: down or up first, then across. */
function solve(drill: Drill): string[] {
  const down = drill.target.line - drill.start.line;
  // j and k keep the start's column where the line is long enough.
  const landed = Math.min(drill.start.col, Math.max(0, drill.text[drill.target.line]!.length - 1));
  const across = drill.target.col - landed;
  return [
    ...Array<string>(Math.abs(down)).fill(down > 0 ? 'j' : 'k'),
    ...Array<string>(Math.abs(across)).fill(across > 0 ? 'l' : 'h'),
  ];
}

test('play a round of Drills in Lesson 1 and see the results', async ({ page }) => {
  await page.goto('vim-practice/?seed=4');
  await expect(page.getByRole('radio', { name: 'h j k l', exact: true })).toBeChecked();
  await expect(page.getByText(tool.notes.start)).toBeVisible();
  const { drills } = newRound(0, seededRandom(4));

  // No click first: the first key press starts. A key outside the Lesson is noted.
  await page.keyboard.press('x');
  await expect(page.getByText('x isn’t a motion in this Lesson.')).toBeVisible();
  await expect(page.getByLabel(tool.areaLabel, { exact: true })).toBeFocused();
  // A half-typed count, cancelled.
  await page.keyboard.press('5');
  await page.keyboard.press('Escape');

  for (const [i, drill] of drills.entries()) {
    await expect(page.getByText(`${i + 1}/10`, { exact: true })).toBeVisible();
    for (const key of solve(drill)) await page.keyboard.press(key);
  }

  await expect(page.getByRole('status')).toHaveText(
    /^Round done in [\d.]+ seconds, with \d+ key presses\. The fewest possible was \d+\.$/,
  );
  await expect(page.getByText(tool.notes.presses, { exact: true })).toBeVisible();
  await expect(page.getByText(tool.notes.mostExtra)).toBeVisible();
  // The first Drill took three extra keys at least, so some Drill is listed.
  await expect(page.getByText(/^Drill \d+: \d+ keys/).first()).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: tool.notes.newRound })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('1/10', { exact: true })).toBeVisible();
  await expect(page.getByLabel(tool.areaLabel, { exact: true })).toBeFocused();
});
