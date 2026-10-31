// Shared logic for Tools the person types into (input mode "none"), in plain TypeScript
// with no page or framework code. There is no Choose or start button and no Batch: the
// result is made again each time typing pauses (or, for a Tool with no type box, each
// time the options stop changing), and only the newest one is kept.

import { fillText, text } from '../text';
import { runOnce } from './running';
import type { ToolDeclaration, ToolTextRun } from './types';

/** The file a typed Tool made, named and ready to save. */
export interface TypedResult {
  id: number;
  name: string;
  size: number;
  blob: Blob;
  /** The text it was made from. */
  typed: string;
  /** The picture's description: what was typed, or the Tool's own `pictureLabel`. */
  label: string;
}

export interface TypedToolPageState {
  /** The newest result, or null while there is none. */
  result: TypedResult | null;
  /** Why there is no result: the Tool's own reason, or the shared one. */
  reason: string | null;
  /** True from a change until its result is ready, so a stale result isn't saved. */
  updating: boolean;
}

/**
 * The state of a typed Tool page. `delay` is how long typing must pause, in
 * milliseconds, before the result is made again.
 */
export function createTypedToolPage<Options extends object>(
  tool: ToolDeclaration<Options>,
  run: ToolTextRun<Options>,
  delay = 150,
) {
  if (tool.input !== 'none') throw new Error(`"${tool.address}" is not a typed Tool`);

  let nextId = 1;
  // Each change takes a new number; a result is only kept if its number is the newest.
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let current: TypedToolPageState = { result: null, reason: null, updating: false };
  const listeners = new Set<(state: TypedToolPageState) => void>();

  const set = (next: TypedToolPageState) => {
    current = next;
    for (const listener of listeners) listener(current);
  };

  async function make(typed: string, options: Options, ticket: number) {
    const outcome = await runOnce(() => run(typed, options), {
      original: tool.address,
      fallback: text.tool.typed.failedFallback,
      logAs: tool.name,
    });
    if (ticket !== latest) return;
    if ('reason' in outcome) {
      set({ result: null, reason: outcome.reason, updating: false });
      return;
    }
    const [made] = outcome.files;
    const result = made && {
      id: nextId++,
      ...made,
      typed,
      label:
        tool.textFor(options).pictureLabel ??
        fillText(text.tool.typed.pictureLabel, { noun: tool.noun.one, typed }),
    };
    set({ result: result ?? null, reason: null, updating: false });
  }

  function later(typed: string, options: Options, ticket: number) {
    set({ ...current, updating: true });
    timer = setTimeout(() => void make(typed, options, ticket), delay);
  }

  return {
    state: () => current,

    /** Calls `listener` with the new state on every change. Returns a stop function. */
    subscribe(listener: (state: TypedToolPageState) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    /** What is in the box now. The result follows once typing pauses. */
    type(typed: string, options: Options) {
      const ticket = ++latest;
      clearTimeout(timer);
      if (typed.trim() === '') {
        set({ result: null, reason: null, updating: false });
        return;
      }
      later(typed, options, ticket);
    },

    /**
     * For a Tool with no type box: the options now. The result follows once they stop
     * changing, and `run` gets "" as the typed text.
     */
    change(options: Options) {
      const ticket = ++latest;
      clearTimeout(timer);
      later('', options, ticket);
    },
  };
}
