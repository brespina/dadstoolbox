import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Every page test gets three checks for free, run after the test body:
// - no request left the Site (the Promise, ADR-0003)
// - the page carries the browser lock (a CSP <meta> tag limiting requests to the Site)
// - axe finds no WCAG 2.2 AA violations, in the light and dark themes
// Every page runs with reduced motion, so the Site's transitions and animations are off
// (base.css): a check never catches a colour or fade halfway, such as the Typing test's
// settings bar fading while typing.
export const test = base.extend<{ siteChecks: void }>({
  siteChecks: [
    async ({ context, page, baseURL }, use) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const siteOrigin = new URL(baseURL!).origin;
      const outside: string[] = [];
      // Watched on the whole context, so requests from workers count too.
      context.on('request', (request) => {
        const url = new URL(request.url());
        if (url.protocol === 'data:' || url.protocol === 'blob:') return;
        if (url.origin !== siteOrigin) outside.push(request.url());
      });

      await use();

      expect(outside, 'requests that left the Site').toEqual([]);

      expectBrowserLock(
        await page.locator('meta[http-equiv="content-security-policy" i]').getAttribute('content'),
        page.url(),
      );

      // Both themes must meet AA contrast.
      for (const colorScheme of ['light', 'dark'] as const) {
        // Reduced motion again, in case the test turned it off: switching it on ends any
        // transition at once.
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(axe.violations, `accessibility problems (${colorScheme} theme)`).toEqual([]);
      }
    },
    { auto: true },
  ],
});

/** Checks a page's browser lock (ADR-0003): the content of its CSP <meta> tag. */
export function expectBrowserLock(csp: string | null | undefined, where: string) {
  expect(csp, `browser lock tag on ${where}`).toBeTruthy();
  expect(csp, `browser lock on ${where}`).toMatch(/(^|;)\s*default-src 'self'/);
  // Exactly the Site plus what stays on the device; Tools that declare outside
  // addresses will widen this list.
  const connectSrc = csp!
    .match(/(?:^|;)\s*connect-src ([^;]*)/)?.[1]
    .trim()
    .split(/\s+/);
  expect(connectSrc, `where ${where} may send requests`).toEqual(["'self'", 'blob:', 'data:']);
}

export { expect };
