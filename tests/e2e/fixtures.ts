import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Every page test gets three checks for free, run after the test body:
// - no request left the Site (the Promise, ADR-0003)
// - the page carries the browser lock (a CSP <meta> tag limiting requests to the Site)
// - axe finds no WCAG 2.2 AA violations, in the light and dark themes
export const test = base.extend<{ siteChecks: void }>({
  siteChecks: [
    async ({ page, baseURL }, use) => {
      const siteOrigin = new URL(baseURL!).origin;
      const outside: string[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.protocol === 'data:' || url.protocol === 'blob:') return;
        if (url.origin !== siteOrigin) outside.push(request.url());
      });

      await use();

      expect(outside, 'requests that left the Site').toEqual([]);

      const csp = await page
        .locator('meta[http-equiv="content-security-policy" i]')
        .getAttribute('content');
      expect(csp, 'browser lock tag').toBeTruthy();
      expect(csp).toMatch(/(^|;)\s*default-src 'self'/);
      // Exactly the Site plus what stays on the device; Tools that declare outside
      // addresses will widen this list.
      const connectSrc = csp!
        .match(/(?:^|;)\s*connect-src ([^;]*)/)?.[1]
        .trim()
        .split(/\s+/);
      expect(connectSrc, 'where the page may send requests').toEqual(["'self'", 'blob:', 'data:']);

      // Both themes must meet AA contrast.
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(axe.violations, `accessibility problems (${colorScheme} theme)`).toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
