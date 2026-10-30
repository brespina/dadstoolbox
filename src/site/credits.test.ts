import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { credits } from './credits';
import { bannedWordsIn } from '../wording';

const root = new URL('../../', import.meta.url);
const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

/** The package.json npm would load for `name`, looked for under `partOf` first. */
function installed(name: string, partOf?: string): { version: string; license: string } {
  const places = partOf ? [`node_modules/${partOf}/node_modules/${name}`] : [];
  for (const place of [...places, `node_modules/${name}`]) {
    try {
      return readJson(`${place}/package.json`);
    } catch {
      // Not here; try the next place.
    }
  }
  throw new Error(`${name} is not installed`);
}

describe('credits', () => {
  it('credit every library the Site depends on', () => {
    const credited = credits.map((credit) => credit.package);
    for (const name of Object.keys(readJson('package.json').dependencies)) {
      expect(credited, `${name} has no credit`).toContain(name);
    }
  });

  it.each(credits.filter((credit) => credit.package).map((credit) => [credit.name, credit]))(
    '%s matches the installed version and license',
    (_name, credit) => {
      const found = installed(credit.package!, credit.partOf);
      expect({ version: credit.version, license: credit.license }).toEqual({
        version: found.version,
        license: found.license,
      });
    },
  );

  it.each(credits.map((credit) => [credit.name, credit.does]))(
    '%s: %j uses only plain words',
    (_name, line) => {
      expect(bannedWordsIn(line)).toEqual([]);
    },
  );
});
