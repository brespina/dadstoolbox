// Finds every Tool's declaration from plain Node, for code that runs outside the Site's
// build: the Astro config (the browser lock) and the generated page tests.
// The Site itself uses registry.ts. Folders starting with "_" are skipped in both.

import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ToolDeclaration } from './types';

export const toolsFolder = fileURLToPath(new URL('.', import.meta.url));

/** Each Tool's declaration and its folder. */
export async function discoverTools(): Promise<{ tool: ToolDeclaration; folder: string }[]> {
  const folders = readdirSync(toolsFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => new URL(`${entry.name}/`, pathToFileURL(toolsFolder)))
    .filter((folder) => existsSync(new URL('declaration.ts', folder)));

  return Promise.all(
    folders.map(async (folder) => {
      const module = (await import(/* @vite-ignore */ new URL('declaration.ts', folder).href)) as {
        tool: ToolDeclaration;
      };
      return { tool: module.tool, folder: fileURLToPath(folder) };
    }),
  );
}
