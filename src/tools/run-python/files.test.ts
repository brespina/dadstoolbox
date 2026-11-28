import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { pyodideFolder, pyodideVersion } from './files';

it('serves the version of Pyodide that is installed', () => {
  const installed = JSON.parse(
    readFileSync(new URL('../../../node_modules/pyodide/package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  expect(pyodideVersion).toBe(installed.version);
  expect(pyodideFolder).toBe(`run-python/pyodide/${installed.version}`);
});
