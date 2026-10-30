// A smoke test for every declared Tool, made from its declaration: open its page,
// choose its sample file, press start, and a Save button appears. A Tool with no file
// (input mode "none") types the text in its sample.txt instead, and a result appears.
// Adding a Tool adds its test; nothing here is written per Tool.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { discoverTools } from '../../src/tools/discover';
import { fillText, text } from '../../src/text';

const tools = await discoverTools();
if (tools.length === 0) throw new Error('No Tools found in src/tools');

for (const { tool, folder } of tools) {
  test.describe(tool.name, () => {
    test('is listed on the home page under its Category', async ({ page }) => {
      await page.goto('./');
      const category = page.getByRole('region', { name: tool.category, exact: true });
      await category.getByRole('link', { name: tool.name }).click();
      await expect(page).toHaveURL(new RegExp(`/${tool.address}/$`));
    });

    if (tool.input === 'none') {
      test('type the sample, a result appears, and Save saves it', async ({ page }) => {
        const typed = readFileSync(join(folder, 'sample.txt'), 'utf8').trim();
        // Save normally, so the saved file can be checked.
        await page.addInitScript(() => {
          navigator.canShare = () => false;
        });
        await page.goto(`${tool.address}/`);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(tool.name);
        await expect(page.getByText(tool.privacyLine)).toBeVisible();
        await expect(page.getByRole('link', { name: text.tool.backLink })).toBeVisible();
        await expect(page.getByRole('button', { name: tool.startButton })).toHaveCount(0);

        await page.getByLabel(tool.typeLabel).fill(typed);
        await expect(
          page.getByRole('img', {
            name: fillText(text.tool.typed.pictureLabel, { noun: tool.noun.one, typed }),
          }),
        ).toBeVisible();
        const saved = page.waitForEvent('download');
        await page.getByRole('button', { name: /^Save / }).click();
        expect((await saved).suggestedFilename()).toMatch(new RegExp(`^${tool.address}_dtb`));
      });
      return;
    }

    test('choose the sample, press start, and Save appears', async ({ page }) => {
      const sample = readdirSync(folder).find((name) => /^sample\.[^.]+$/.test(name));
      expect(sample, `a sample file in ${folder}`).toBeTruthy();

      await page.goto(`${tool.address}/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(tool.name);
      await expect(page.getByText(tool.privacyLine)).toBeVisible();
      await expect(page.getByRole('link', { name: text.tool.backLink })).toBeVisible();

      const chooser = page.waitForEvent('filechooser');
      await page.getByText(fillText(text.tool.choose, { noun: tool.noun.many })).click();
      await (await chooser).setFiles(join(folder, sample!));
      await expect(page.getByText(sample!)).toBeVisible();

      await page.getByRole('button', { name: tool.startButton }).click();
      // Some Tools take a few seconds, such as one reading video frames.
      await expect(page.getByRole('button', { name: /^Save / }).first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(tool.allDone)).toBeVisible();
    });
  });
}
