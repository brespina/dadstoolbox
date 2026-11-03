import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { expectBrowserLock } from './fixtures';

// Every built page carries the browser lock (ADR-0003), including pages no other test
// opens, such as an old address that only forwards. The page tests' web server builds
// the Site into dist/ before any test runs.
test('every built page carries the browser lock', () => {
  const pages = readdirSync('dist', { recursive: true, encoding: 'utf8' }).filter((file) =>
    file.endsWith('.html'),
  );
  const sourcePages = readdirSync('src/pages', { recursive: true, encoding: 'utf8' }).filter(
    (file) => file.endsWith('.astro'),
  );
  expect(pages.length, 'built pages').toBeGreaterThanOrEqual(sourcePages.length);

  for (const file of pages) {
    const html = readFileSync(join('dist', file), 'utf8');
    const tag = html.match(/<meta\b[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/i)?.[0];
    const csp = tag
      ?.match(/\bcontent="([^"]*)"/i)?.[1]
      .replaceAll('&#39;', "'")
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&');
    expectBrowserLock(csp, file);
  }
});
