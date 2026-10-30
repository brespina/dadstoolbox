import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import { cspDirectives } from './src/site/csp';
import { discoverTools } from './src/tools/discover';
import { toolRuns } from './src/tools/tool-runs';

const tools = await discoverTools();
const outsideAddresses = tools.flatMap(({ tool }) => tool.outsideAddresses);

export default defineConfig({
  site: 'https://bwandii.io',
  base: '/dadstoolbox',
  output: 'static',
  trailingSlash: 'always',
  integrations: [svelte()],
  // Shiki's inline styles break the browser lock, and the Site has no code samples.
  markdown: { syntaxHighlight: false },
  // The Tool worker loads each worker Tool's `run` only when asked, which needs module
  // workers. Each Tool's `run` is built only for the side it runs on (see tool-runs.ts).
  vite: {
    plugins: [toolRuns(tools)],
    worker: {
      format: 'es',
      plugins: () => [toolRuns(tools)],
      // The worker's shared code (worker.ts and all it brings in, such as ToolFailure)
      // gets its own file. Otherwise a Tool's `run` file imports the worker's own entry
      // file, and Safari runs that a second time: a second ToolFailure, so a Tool's
      // plain reason showed as the shared fallback.
      rolldownOptions: {
        output: {
          codeSplitting: { groups: [{ name: 'worker-shared', test: /\/src\/tools\/worker\.ts$/ }] },
        },
      },
    },
  },
  security: {
    // The browser lock (ADR-0003): each page may only talk to the Site, plus the
    // outside addresses Tools declare.
    csp: { directives: cspDirectives(outsideAddresses) },
  },
});
