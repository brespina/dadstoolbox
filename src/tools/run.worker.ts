// The Web Worker that runs a Tool's `run` when its declaration marks it as worker. Each
// Tool's `run` (and its library) loads here only when that Tool asks for it.

import { serveRuns, type AnyRun } from './worker';

const runModules = import.meta.glob<{ run: AnyRun }>(['./*/run.ts', '!./_*/run.ts']);

serveRuns(self as unknown as Worker, async (address) => {
  const load = runModules[`./${address}/run.ts`];
  if (!load) throw new Error(`No Tool at "${address}"`);
  return (await load()).run;
});
