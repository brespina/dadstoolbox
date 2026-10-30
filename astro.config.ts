import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import { cspDirectives } from './src/site/csp';
import { discoverTools } from './src/tools/discover';

const outsideAddresses = (await discoverTools()).flatMap(({ tool }) => tool.outsideAddresses);

export default defineConfig({
  site: 'https://bwandii.io',
  base: '/dadstoolbox',
  output: 'static',
  trailingSlash: 'always',
  integrations: [svelte()],
  // Shiki's inline styles break the browser lock, and the Site has no code samples.
  markdown: { syntaxHighlight: false },
  security: {
    // The browser lock (ADR-0003): each page may only talk to the Site, plus the
    // outside addresses Tools declare.
    csp: { directives: cspDirectives(outsideAddresses) },
  },
});
