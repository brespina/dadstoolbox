// Shared Batch logic: the state of a Tool page, in plain TypeScript with no page or
// framework code. The Svelte Tool page only shows this state and calls its methods.

import { text } from '../text';
import { ToolFailure, type ToolDeclaration, type ToolResult, type ToolRun } from './types';

/** A chosen file on the waiting list. */
export interface WaitingFile {
  id: number;
  name: string;
  size: number;
  status: 'ready';
}

export type ItemStatus = 'ready' | 'working' | 'done' | 'failed';

/** One file a Tool made, named and ready to save. */
export interface ResultFile {
  id: number;
  name: string;
  size: number;
  blob: Blob;
}

/** One row of a Batch: a chosen file and what became of it. */
export interface BatchItem {
  id: number;
  name: string;
  size: number;
  status: ItemStatus;
  /** Why it didn't work: the Tool's own reason, or the shared one. */
  reason?: string;
  results: ResultFile[];
}

/** The results from one press of the start button. */
export interface Batch {
  id: number;
  /** Such as "3 PDFs". */
  label: string;
  items: BatchItem[];
  /** Which file is being worked on, or null once the Batch is finished. */
  progress: { current: number; total: number } | null;
}

export interface ToolPageState {
  waiting: WaitingFile[];
  /** Newest first. */
  batches: Batch[];
  /** True while a Batch is being worked on. */
  working: boolean;
}

const extensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function splitName(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot + 1) } : { base: name, ext: '' };
}

/**
 * The state of one Tool page. Every change hands listeners a fresh snapshot, so the
 * page can show it as it is.
 */
export function createToolPage<Options extends object>(
  tool: ToolDeclaration<Options>,
  run: ToolRun<Options>,
) {
  if (tool.input !== 'each') throw new Error(`Input mode "${tool.input}" is not built yet`);

  let nextId = 1;
  let waiting: { entry: WaitingFile; file: File }[] = [];
  let batches: Batch[] = [];
  let working = false;
  // Kept in lower case: phones and Macs treat Report.PDF and report.pdf as one file.
  const takenNames = new Set<string>();
  const isTaken = (name: string) => takenNames.has(name.toLowerCase());
  const take = (name: string) => takenNames.add(name.toLowerCase());
  const listeners = new Set<(state: ToolPageState) => void>();

  const state = (): ToolPageState => ({
    waiting: waiting.map(({ entry }) => entry),
    batches,
    working,
  });

  const changed = () => {
    const snapshot = state();
    for (const listener of listeners) listener(snapshot);
  };

  /** Replaces the newest Batch with a changed copy, so old snapshots stay as they were. */
  const updateNewest = (change: (batch: Batch) => Batch) => {
    batches = [change(batches[0]!), ...batches.slice(1)];
    changed();
  };

  const updateItem = (id: number, change: Partial<BatchItem>) =>
    updateNewest((batch) => ({
      ...batch,
      items: batch.items.map((item) => (item.id === id ? { ...item, ...change } : item)),
    }));

  /** `<original>_dtb[_<detail>].<ext>`, with _2, _3 for repeats anywhere on the page. */
  function nameResult(original: string, result: ToolResult) {
    const { base, ext: originalExt } = splitName(original);
    const ext = extensions[result.blob.type] ?? originalExt;
    const stem = `${base}_dtb${result.detail ? `_${result.detail}` : ''}`;
    const dotExt = ext ? `.${ext}` : '';
    let name = `${stem}${dotExt}`;
    for (let n = 2; isTaken(name); n++) name = `${stem}_${n}${dotExt}`;
    take(name);
    return name;
  }

  async function runOne(item: BatchItem, file: File, options: Options) {
    try {
      const results = await run(file, options);
      const named = results.map((result) => ({
        id: nextId++,
        name: nameResult(file.name, result),
        size: result.blob.size,
        blob: result.blob,
      }));
      updateItem(item.id, { status: 'done', results: named });
    } catch (error) {
      let reason: string = text.tool.failedFallback;
      if (error instanceof ToolFailure) reason = error.reason;
      else console.error(`${tool.name}: ${file.name}`, error);
      updateItem(item.id, { status: 'failed', reason });
    }
  }

  return {
    state,

    /** Calls `listener` with a new snapshot on every change. Returns a stop function. */
    subscribe(listener: (state: ToolPageState) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    /** Adds chosen files to the waiting list as Ready. */
    add(files: Iterable<File>) {
      for (const file of files) {
        // A result must never take a chosen file's name, so saving it can't replace one.
        take(file.name);
        waiting.push({
          entry: { id: nextId++, name: file.name, size: file.size, status: 'ready' },
          file,
        });
      }
      changed();
    },

    remove(id: number) {
      waiting = waiting.filter(({ entry }) => entry.id !== id);
      changed();
    },

    /** The start button: makes a new Batch on top from the waiting list and works through it. */
    async start(options: Options) {
      if (working || waiting.length === 0) return;
      working = true;
      const work = waiting.map(({ file }) => {
        const item: BatchItem = {
          id: nextId++,
          name: file.name,
          size: file.size,
          status: 'ready',
          results: [],
        };
        return { file, item };
      });
      waiting = [];
      const total = work.length;
      batches = [
        {
          id: nextId++,
          label: `${total} ${total === 1 ? tool.noun.one : tool.noun.many}`,
          items: work.map(({ item }) => item),
          progress: { current: 1, total },
        },
        ...batches,
      ];
      changed();

      for (const [index, { file, item }] of work.entries()) {
        updateNewest((batch) => ({ ...batch, progress: { current: index + 1, total } }));
        updateItem(item.id, { status: 'working' });
        await runOne(item, file, options);
      }

      working = false;
      updateNewest((batch) => ({ ...batch, progress: null }));
    },

    /** Every result of the newest Batch, for Save all. */
    saveAllFiles(): ResultFile[] {
      return batches[0]?.items.flatMap((item) => item.results) ?? [];
    },
  };
}
