// Made by tool-runs.ts: a loader for each Tool's `run`, by address, split by where it runs.

declare module 'virtual:tool-runs/page' {
  /** Its `run` type follows the Tool's input mode: typed text for "none", else files. */
  const runModules: Record<
    string,
    () => Promise<{ run: import('./worker').AnyRun | import('./types').ToolTextRun<object> }>
  >;
  export default runModules;
}

declare module 'virtual:tool-runs/worker' {
  const runModules: Record<string, () => Promise<{ run: import('./worker').AnyRun }>>;
  export default runModules;
}
