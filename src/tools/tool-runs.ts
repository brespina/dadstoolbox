// Builds the loaders for each Tool's `run`, split by where it runs:
// - `virtual:tool-runs/page`: Tools whose `run` runs on the page
// - `virtual:tool-runs/worker`: Tools marked worker, for run.worker.ts
// A glob over every Tool's `run` on both sides would put a second copy of every library
// (such as the 3 MB iPhone photo decoder) into files nothing ever asks for. The Astro
// config adds this to both the page and worker builds. It reads the Tools when the
// config loads, so restart the dev server after changing a Tool's `worker` flag.

import { join } from 'node:path';
import type { Plugin } from 'vite';
import type { ToolDeclaration } from './types';

const prefix = 'virtual:tool-runs/';
const sides = { page: false, worker: true } as const;

export function toolRuns(tools: { tool: ToolDeclaration; folder: string }[]): Plugin {
  return {
    name: 'dadstoolbox:tool-runs',
    resolveId: (source) => (source.startsWith(prefix) ? `\0${source}` : undefined),
    load(id) {
      if (!id.startsWith(`\0${prefix}`)) return;
      const side = id.slice(prefix.length + 1);
      if (!(side in sides)) throw new Error(`No "${side}" side for Tool runs`);
      const loaders = tools
        .filter(({ tool }) => tool.worker === sides[side as keyof typeof sides])
        .map(
          ({ tool, folder }) =>
            `${JSON.stringify(tool.address)}: () => import(${JSON.stringify(join(folder, 'run.ts'))}),`,
        );
      return `export default {\n${loaders.join('\n')}\n};\n`;
    },
  };
}
