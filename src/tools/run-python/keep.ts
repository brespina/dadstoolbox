// Run Python's Keep (#132, ADR-0011): the one thing the Site stores at all, and only when
// the visitor chooses. Pure: the storage comes in as an argument, so Vitest passes a
// stand-in and the page passes `localStorage`.
//
// - Never keep (the default) stores nothing, including the choice itself.
// - Keep stores two entries, the choice and the Program's text, under keys that begin
//   `dadstoolbox:run-python:`. A choice is only ever on disk with a Program beside it.
// - What is read back is distrusted: text only, under the size cap, the exact marker.
//   Anything else is removed. It goes into the editor and is never run.
import { maxProgramBytes } from './files';

export const keepKeys = {
  choice: 'dadstoolbox:run-python:keep',
  program: 'dadstoolbox:run-python:program',
} as const;

/** What the choice entry holds under Keep. Under Never keep there is no entry at all. */
const marker = 'keep';

/** How long after typing stops the Program is written (about half a second). */
const defaultDelay = 500;

export type KeepChoice = 'never' | 'keep';

/** The part of `localStorage` Keep uses. */
export type KeepStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** True for text a Program can be: no NUL byte, and no more than the cap in UTF-8. */
function fitsProgram(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !value.includes('\u0000') &&
    new TextEncoder().encode(value).length <= maxProgramBytes
  );
}

/** Removes both entries, each in its own try so one refusal doesn't leave the other. */
function removeBoth(store: KeepStore | undefined) {
  for (const key of Object.values(keepKeys)) {
    try {
      store?.removeItem(key);
    } catch {
      // Nothing more can be done about a storage that refuses even this.
    }
  }
}

/**
 * Reads what was kept, once, when the page opens. Never throws. A kept Program comes
 * back only when Keep was chosen and the Program is text under the cap; anything else
 * (a Program without the choice, a choice without a Program, another project's value)
 * is removed and the page opens on Never keep.
 */
export function openKept(store: KeepStore | undefined): { choice: KeepChoice; program?: string } {
  if (!store) return { choice: 'never' };
  try {
    const choice = store.getItem(keepKeys.choice);
    const program = store.getItem(keepKeys.program);
    if (choice === null && program === null) return { choice: 'never' };
    if (choice === marker && fitsProgram(program)) return { choice: 'keep', program };
  } catch {
    return { choice: 'never' };
  }
  removeBoth(store);
  return { choice: 'never' };
}

export type Keeper = {
  /**
   * Switches the choice. Keep writes both entries now and returns false if it can't (the
   * caller then shows Never keep and says so); Never keep deletes both and returns true.
   */
  choose(choice: KeepChoice, program: string): boolean;
  /** The Program changed (typed, or a file was chosen). Written after a short quiet spell. */
  edited(program: string): void;
  /** Writes a pending edit now: for when the page is hidden. */
  flush(): void;
  /** Writes a pending edit and stops. */
  dispose(): void;
};

export function createKeeper(options: {
  store: KeepStore | undefined;
  initial: KeepChoice;
  /** Called when a later write is refused; the entries are already removed. */
  onRefused: () => void;
  delayMs?: number;
}): Keeper {
  const { store, onRefused, delayMs = defaultDelay } = options;
  let keeping = options.initial === 'keep';
  let pending: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  }

  /** Writes the Program, then the choice; false (with nothing left behind) on any refusal. */
  function write(program: string, withChoice: boolean): boolean {
    try {
      if (!store || !fitsProgram(program)) throw new Error('cannot keep');
      store.setItem(keepKeys.program, program);
      if (withChoice) store.setItem(keepKeys.choice, marker);
      return true;
    } catch {
      removeBoth(store);
      return false;
    }
  }

  function flush() {
    const program = pending;
    cancel();
    if (program === undefined || !keeping) return;
    if (!write(program, false)) {
      keeping = false;
      onRefused();
    }
  }

  return {
    choose(choice, program) {
      cancel();
      if (choice === 'never') {
        keeping = false;
        removeBoth(store);
        return true;
      }
      keeping = write(program, true);
      return keeping;
    },
    edited(program) {
      if (!keeping) return;
      pending = program;
      clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    dispose() {
      flush();
      keeping = false;
    },
  };
}
