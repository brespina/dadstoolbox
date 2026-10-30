// Running a Tool's `run` in a Web Worker, through Comlink, for Tools whose declaration
// marks it as worker. Both ends take any message endpoint, so tests can use a
// MessageChannel instead of a real worker.

import * as Comlink from 'comlink';
import { ToolFailure, type ToolResult, type ToolRunContext } from './types';

/** A Tool's `run`, taking one file or the ordered list, as its input mode says. */
export type AnyRun = (
  input: File | File[],
  options: object,
  context?: ToolRunContext,
) => Promise<ToolResult[]>;

/** Tells the page when the worker starts and stops waiting for something to load. */
interface Loading {
  loading(on: boolean): void;
}

/**
 * Comlink rebuilds a thrown error as a plain Error, which would lose a Tool's own
 * reason, so a ToolFailure crosses as an answer instead.
 */
type Answer = { results: ToolResult[] } | { failure: string };

/** The worker's side: runs the asked-for Tool's `run`, loaded by its address. */
export function serveRuns(
  endpoint: Comlink.Endpoint,
  loadRun: (address: string) => Promise<AnyRun>,
) {
  const served = {
    async run(
      address: string,
      input: File | File[],
      options: object,
      page: Comlink.Remote<Loading>,
    ): Promise<Answer> {
      let loads = 0;
      const context: ToolRunContext = {
        async gettingReady(loading) {
          if (loads++ === 0) page.loading(true);
          try {
            return await loading;
          } finally {
            if (--loads === 0) page.loading(false);
          }
        },
      };
      try {
        return { results: await (await loadRun(address))(input, options, context) };
      } catch (error) {
        if (error instanceof ToolFailure) return { failure: error.reason };
        throw error;
      } finally {
        // Close the page's line for this run.
        page[Comlink.releaseProxy]();
      }
    },
  };
  Comlink.expose(served, endpoint);
}

/**
 * The page's side: a `run` that hands the work to the worker at `endpoint`. `died`
 * rejects if the worker stops (it failed to load, or the phone ran out of memory);
 * without it, a run waiting on a dead worker would never finish.
 */
export function runInWorker(
  endpoint: Comlink.Endpoint,
  address: string,
  died: Promise<never> = new Promise<never>(() => {}),
): AnyRun {
  const worker = Comlink.wrap<{
    run(address: string, input: File | File[], options: object, page: Loading): Promise<Answer>;
  }>(endpoint);
  return async (input, options, context) => {
    let loaded: (() => void) | undefined;
    const page = Comlink.proxy<Loading>({
      loading(on) {
        if (on) void context?.gettingReady(new Promise<void>((resolve) => (loaded = resolve)));
        else loaded?.();
      },
    });
    try {
      const answer = await Promise.race([worker.run(address, input, options, page), died]);
      if ('failure' in answer) throw new ToolFailure(answer.failure);
      return answer.results;
    } finally {
      loaded?.();
    }
  };
}
