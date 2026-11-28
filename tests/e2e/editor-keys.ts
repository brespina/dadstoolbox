import type { Page } from '@playwright/test';

// CodeMirror reads an iPhone (even Playwright's emulated one on Linux) as a Mac, so its
// "Mod" key is Meta there and Control elsewhere. Redo is Mod-Shift-z on a Mac, Mod-y elsewhere.
async function isMac(page: Page) {
  return page.evaluate(() => /iPhone|iPad|Mac/.test(navigator.userAgent + navigator.platform));
}

/** The shortcut for "select all" in the editor on this page's browser. */
export async function selectAllKey(page: Page) {
  return (await isMac(page)) ? 'Meta+a' : 'Control+a';
}

export async function undoKey(page: Page) {
  return (await isMac(page)) ? 'Meta+z' : 'Control+z';
}

export async function redoKey(page: Page) {
  return (await isMac(page)) ? 'Meta+Shift+Z' : 'Control+y';
}
