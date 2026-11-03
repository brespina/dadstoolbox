// Vim practice: a round of Drills in Lesson 1, played with h j k l, and one in Lesson 4,
// played with f, t and the like. `?seed=` in the address makes the page draw the same
// Drills as `newRound` does here.
import { test, expect } from './fixtures';
import { seededRandom } from '../../src/practice/random';
import { lessonMotions } from '../../src/tools/vim-practice/lessons';
import { newRound, type Drill } from '../../src/tools/vim-practice/round';
import { tool } from '../../src/tools/vim-practice/declaration';
import { feed, startState, type VimState } from '../../src/tools/vim-practice/vim';

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

/** The fewest keys for a Drill, found by trying every key of the Lesson, a step at a time. */
function shortest(drill: Drill, lesson: number): string[] {
  const allowed = lessonMotions(lesson);
  const alphabet = new Set([
    ...Object.keys(allowed).join(''),
    ...'123456789',
    ...drill.text.join(''),
  ]);
  const start = startState(drill.start);
  let paths = [{ state: start, keys: [] as string[] }];
  const seen = new Set([JSON.stringify(start)]);
  for (let length = 0; length <= drill.fewest; length++) {
    const done = paths.find(({ state: { cursor } }) => {
      return cursor.line === drill.target.line && cursor.col === drill.target.col;
    });
    if (done) return done.keys;
    const next: { state: VimState; keys: string[] }[] = [];
    for (const { state, keys } of paths) {
      for (const key of alphabet) {
        const after = feed(drill.text, state, key, allowed).state;
        const id = JSON.stringify(after);
        if (seen.has(id)) continue;
        seen.add(id);
        next.push({ state: after, keys: [...keys, key] });
      }
    }
    paths = next;
  }
  throw new Error('no keys found for the Drill');
}

test('play a round of Drills in Lesson 4 with f, t and ;', async ({ page }) => {
  await page.goto('vim-practice/?seed=4');
  await page.getByRole('radio', { name: 'f F t T ; ,', exact: true }).check();
  const { drills } = newRound(3, seededRandom(4));
  await page.getByLabel(tool.areaLabel, { exact: true }).focus();

  // A half-typed find waits for its character, and Escape cancels it.
  await page.keyboard.press('3');
  await page.keyboard.press('f');
  await expect(page.locator('.pending')).toHaveText('3f');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pending')).toHaveText('');

  for (const [i, drill] of drills.entries()) {
    await expect(page.getByText(`${i + 1}/10`, { exact: true })).toBeVisible();
    for (const key of shortest(drill, 3)) await page.keyboard.press(key);
  }

  // Every Drill took the fewest keys, except for the three spent on the cancelled find.
  const fewest = drills.reduce((sum, drill) => sum + drill.fewest, 0);
  await expect(page.getByRole('status')).toHaveText(
    new RegExp(`with ${fewest + 3} key presses\\. The fewest possible was ${fewest}\\.$`),
  );
  await expect(page.getByText(/^Drill 1: \d+ keys, 3 more than the fewest$/)).toBeVisible();
});
