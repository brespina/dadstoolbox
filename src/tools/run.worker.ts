// The Web Worker that runs a Tool's `run` when its declaration marks it as worker. Each
// Tool's `run` (and its library) loads here only when that Tool asks for it.

import runModules from 'virtual:tool-runs/worker';
import { serveRuns } from './worker';

serveRuns(self as unknown as Worker, async (address) => {
  const load = runModules[address];
  if (!load) throw new Error(`No worker Tool at "${address}"`);
  return (await load()).run;
});
