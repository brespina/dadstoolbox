// Shared Batch logic: the state of a Tool page, in plain TypeScript with no page or
// framework code. The Svelte Tool page only shows this state and calls its methods.

import { fillText, text } from '../text';
import {
  ToolFailure,
  wordsFor,
  type ToolDeclaration,
  type ToolResult,
  type ToolRun,
  type ToolRunContext,
  type ToolRunTogether,
  wholePercent,
} from './types';

/** A chosen file on the waiting list. */
export interface WaitingFile {
  id: number;
  name: string;
  size: number;
  status: 'ready';
  /** Bigger than the Tool's large-file limit, so its Ready row gets a note. */
  large: boolean;
  /** The chosen file itself, for a Tool's note on its Ready row. */
  file: File;
  /** This file's own values for the Tool's `fileOptions`, set on its Ready row. */
  fileOptions: object;
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
  /** How far along this row is while working, as a whole percent, if its Tool says. */
  percent?: number;
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
  /** True while the Tool waits for something to load, shown as "Getting ready…". */
  gettingReady: boolean;
  /** The "All done" message for the options this Batch was made with. */
  allDone: string;
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
  'video/mp4': 'mp4',
  'audio/mp4': 'm4a',
};

/** The same text for equal options, whatever order their keys were set in. */
function optionsKey(options: object): string {
  return JSON.stringify(options, (_key, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  );
}

function splitName(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot + 1) } : { base: name, ext: '' };
}

export type ToolPage<Options extends object> = ReturnType<typeof makeToolPage<Options>>;

/**
 * The state of one Tool page. Every change hands listeners a fresh snapshot, so the
 * page can show it as it is. `run` takes one file, or for "all files together" the
 * ordered list.
 */
export function createToolPage<Options extends object>(
  tool: ToolDeclaration<Options>,
  run: ToolRun<Options>,
): ToolPage<Options>;
export function createToolPage<Options extends object>(
  tool: ToolDeclaration<Options>,
  run: ToolRunTogether<Options>,
): ToolPage<Options>;
export function createToolPage<Options extends object>(
  tool: ToolDeclaration<Options>,
  run: ToolRun<Options> | ToolRunTogether<Options>,
) {
  return makeToolPage(tool, run);
}

function makeToolPage<Options extends object>(
  tool: ToolDeclaration<Options>,
  run: ToolRun<Options> | ToolRunTogether<Options>,
) {
  if (tool.input === 'none') throw new Error(`Input mode "${tool.input}" is not built yet`);

  let nextId = 1;
  // Each file on its own: every chosen file stays chosen until the page closes, so
  // changed options can run it again. `ranWith` holds the options it has run with, as
  // optionsKey text. All files together: the list is used up by each press.
  // `fileOptions` holds the file's own values for the Tool's `fileOptions`, which
  // replace the page's options for that file.
  type Chosen = { entry: WaitingFile; file: File; ranWith: Set<string>; fileOptions: object };
  let chosen: Chosen[] = [];
  const waiting = () => chosen.filter(({ ranWith }) => ranWith.size === 0);
  const forFile = (options: Options, { fileOptions }: Chosen): Options => ({
    ...options,
    ...fileOptions,
  });
  const toDo = (options: Options) => {
    if (tool.input === 'together') return waiting();
    return chosen.filter((c) => !c.ranWith.has(optionsKey(forFile(options, c))));
  };
  /** Files to run, unless one can't run with its options yet: then start waits. */
  const ready = (options: Options) => {
    const todo = toDo(options);
    return todo.some((c) => tool.optionsProblem(forFile(options, c))) ? [] : todo;
  };
  const startingFileOptions = () =>
    Object.fromEntries(tool.fileOptions.map((key) => [key, tool.defaultOptions[key]]));
  let batches: Batch[] = [];
  let working = false;
  // Kept in lower case: phones and Macs treat Report.PDF and report.pdf as one file.
  const takenNames = new Set<string>();
  const isTaken = (name: string) => takenNames.has(name.toLowerCase());
  const take = (name: string) => takenNames.add(name.toLowerCase());
  const listeners = new Set<(state: ToolPageState) => void>();

  const state = (): ToolPageState => ({
    // Files never run yet. Files run before are in their Batches.
    waiting: waiting().map(({ entry, fileOptions }) => ({ ...entry, fileOptions })),
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

  // Counted, so loads that overlap all finish before "Getting ready…" goes.
  let loads = 0;
  const gettingReady: ToolRunContext['gettingReady'] = async (loading) => {
    if (loads++ === 0) updateNewest((batch) => ({ ...batch, gettingReady: true }));
    try {
      return await loading;
    } finally {
      if (--loads === 0) updateNewest((batch) => ({ ...batch, gettingReady: false }));
    }
  };

  /** The context for one row's run: its progress goes on that row. */
  const contextFor = (item: BatchItem): ToolRunContext => {
    let shown: number | undefined;
    return {
      gettingReady,
      progress(fraction) {
        const percent = wholePercent(fraction);
        if (percent === shown) return;
        shown = percent;
        updateItem(item.id, { percent });
      },
    };
  };

  /** Runs one row's work and records its named results, or why it didn't work. */
  async function runRow(item: BatchItem, original: string, work: () => Promise<ToolResult[]>) {
    try {
      const results = await work();
      const named = results.map((result) => ({
        id: nextId++,
        name: nameResult(original, result),
        size: result.blob.size,
        blob: result.blob,
      }));
      updateItem(item.id, { status: 'done', results: named });
    } catch (error) {
      let reason: string = text.tool.failedFallback;
      if (error instanceof ToolFailure) reason = error.reason;
      else console.error(`${tool.name}: ${item.name}`, error);
      updateItem(item.id, { status: 'failed', reason });
    }
  }

  const runOne = (item: BatchItem, file: File, options: Options) =>
    runRow(item, file.name, () => (run as ToolRun<Options>)(file, options, contextFor(item)));

  /** Such as "PNG · 3 photos", or "3 photos" when the Tool has no words for its options. */
  const batchLabel = (total: number, options: Options) => {
    const count = `${total} ${total === 1 ? tool.noun.one : tool.noun.many}`;
    const words = wordsFor(tool, options).batchLabel;
    return words ? fillText(text.tool.batchLabel, { options: words, count }) : count;
  };

  /** All files together: one row and one run over the waiting list, in its order. */
  async function startTogether(options: Options) {
    const files = chosen.map(({ file }) => file);
    chosen = [];
    const item: BatchItem = {
      id: nextId++,
      name: files.map((f) => f.name).join(', '),
      size: files.reduce((total, f) => total + f.size, 0),
      status: 'ready',
      results: [],
    };
    batches = [
      {
        id: nextId++,
        label: batchLabel(files.length, options),
        items: [item],
        progress: { current: 1, total: 1 },
        gettingReady: false,
        allDone: wordsFor(tool, options).allDone,
      },
      ...batches,
    ];
    changed();
    updateItem(item.id, { status: 'working' });
    // Results of this mode are named after "combined", as in combined_dtb.pdf.
    await runRow(item, 'combined', () =>
      (run as ToolRunTogether<Options>)(files, options, contextFor(item)),
    );
    working = false;
    updateNewest((batch) => ({ ...batch, progress: null }));
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
        chosen.push({
          entry: {
            id: nextId++,
            name: file.name,
            size: file.size,
            status: 'ready',
            large: file.size > tool.largeFileLimit,
            file,
            fileOptions: {},
          },
          file,
          ranWith: new Set(),
          fileOptions: startingFileOptions(),
        });
      }
      changed();
    },

    /**
     * Sets a waiting file's own values for some of the Tool's `fileOptions`, such as
     * where Trim a video starts. Plain values only: a worker gets a copy.
     */
    setFileOptions(id: number, values: Partial<Options>) {
      chosen = chosen.map((c) =>
        c.entry.id === id ? { ...c, fileOptions: { ...c.fileOptions, ...values } } : c,
      );
      changed();
    },

    /** Takes a file off the waiting list. */
    remove(id: number) {
      chosen = chosen.filter(({ entry }) => entry.id !== id);
      changed();
    },

    /**
     * Moves a file one place up (-1) or down (1). The ends stay put. Used by "all files
     * together", where every chosen file is on the waiting list.
     */
    move(id: number, by: -1 | 1) {
      const from = chosen.findIndex(({ entry }) => entry.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= chosen.length) return;
      chosen = chosen.slice();
      [chosen[from], chosen[to]] = [chosen[to]!, chosen[from]!];
      changed();
    },

    /**
     * Whether start has anything to do with these options: for each file on its own, a
     * file not yet run with them. A file that didn't work counts as run; choosing it
     * again runs it again.
     */
    hasWork(options: Options): boolean {
      return ready(options).length > 0;
    },

    /**
     * The start button: makes a new Batch on top and works through it. Each file on its
     * own: only the files not yet run with these options.
     */
    async start(options: Options) {
      const todo = ready(options);
      if (working || todo.length === 0) return;
      working = true;
      if (tool.input === 'together') return startTogether(options);
      const work = todo.map((c) => {
        const { file } = c;
        const fileOptions = forFile(options, c);
        c.ranWith.add(optionsKey(fileOptions));
        const item: BatchItem = {
          id: nextId++,
          name: file.name,
          size: file.size,
          status: 'ready',
          results: [],
        };
        return { file, item, fileOptions };
      });
      const total = work.length;
      batches = [
        {
          id: nextId++,
          label: batchLabel(total, options),
          items: work.map(({ item }) => item),
          progress: { current: 1, total },
          gettingReady: false,
          allDone: wordsFor(tool, options).allDone,
        },
        ...batches,
      ];
      changed();

      for (const [index, { file, item, fileOptions }] of work.entries()) {
        updateNewest((batch) => ({ ...batch, progress: { current: index + 1, total } }));
        updateItem(item.id, { status: 'working' });
        await runOne(item, file, fileOptions);
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
