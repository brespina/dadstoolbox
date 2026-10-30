// The Tool module contract. Each Tool folder in src/tools holds:
// - declaration.ts: plain data made with defineTool (no Svelte, no libraries,
//   because plain Node reads it too: the browser lock and the generated page test)
// - run.ts: exports `run`, the Tool's job, in plain TypeScript
// - Options.svelte: the Tool's options, bound to an options object
// - sample.<ext>: the file the generated page test chooses (sample.txt: the text it
//   types, for input mode "none"; sample.json: each field's value by its label, for a
//   Tool with no type box)
// Folders starting with "_" are skipped by discovery.

import { fillText, text } from '../text';

/** The fixed, ordered list of Categories. */
export const categories = ['Photos', 'PDFs', 'Video', 'Other'] as const;
export type Category = (typeof categories)[number];

/**
 * How a Tool takes its input:
 * - each: each file on its own, one run per file
 * - together: all files together, one run over the ordered list
 * - none: no file; the person types instead
 */
export type InputMode = 'each' | 'together' | 'none';

/** Browser features a Tool may need, checked when the page runs. */
/**
 * - webcodecs: reading video frames
 * - makeVideo: making video (a video encoder)
 */
export type BrowserFeature = 'webcodecs' | 'makeVideo';

/** Words that follow the chosen options. */
export interface OptionsText {
  /** Replaces the start button's words, as in "Change to PNG". */
  startButton?: string;
  /** Goes before the count in a Batch's label, as in "PNG · 3 photos". */
  batchLabel?: string;
  /** Replaces the "All done" message for a Batch made with these options. */
  allDone?: string;
  /**
   * The description of a typed Tool's result picture. Defaults to "{noun} that says:
   * {typed}". A Tool with no type box (`typeBox: false`) sets it, so the picture is
   * described from its options.
   */
  pictureLabel?: string;
}

export interface ToolDeclarationInput<Options extends object> {
  /** Flat address name in plain words, such as "split-pdf". */
  address: string;
  /** The Tool's name, written as a task. */
  name: string;
  /** One line in everyday words. */
  blurb: string;
  category: Category;
  /** Position within the Category, lowest first. */
  position: number;
  /** What the Tool takes, for the privacy line, Choose button and Batch labels. */
  noun: { one: string; many: string };
  /** File types for the Choose button, such as "application/pdf" or ".pdf". */
  accept: readonly string[];
  input: InputMode;
  /** The label on the box a person types into (input mode "none"). */
  typeLabel?: string;
  /**
   * Input mode "none" only: whether the page shows the shared type box. Defaults to true.
   * With false, the options hold all the input: `run` gets "" as the typed text, and the
   * result is made again whenever the options change.
   */
  typeBox?: boolean;
  needs: readonly BrowserFeature[];
  /** Files bigger than this (in bytes) get a note on their Ready row. */
  largeFileLimit: number;
  /** That note. Defaults to the shared one with the Tool's noun swapped in. */
  largeFileNote?: string;
  /** Words on the start button, saying what will happen. */
  startButton: string;
  /** Defaults to the Promise line with the Tool's noun swapped in. */
  privacyLine?: string;
  /** Shown when a Batch finishes. */
  allDone?: string;
  /**
   * Words that follow the chosen options, such as "Change to PNG". Each one left out
   * falls back to the declaration's own.
   */
  textFor?: (options: Options) => OptionsText;
  /** The Tool's own plain-language failure reasons, thrown by `run` as ToolFailure. */
  reasons?: Readonly<Record<string, string>>;
  /** Other words the Tool shows, such as its note on a Ready row (see ReadyNote). */
  notes?: Readonly<Record<string, string>>;
  /** Whether `run` runs in a Web Worker. */
  worker: boolean;
  /** Outside origins the Tool may contact. They widen the browser lock. */
  outsideAddresses: readonly string[];
  defaultOptions: Options;
  /**
   * Options each chosen file has its own value for, such as Trim a video's start and
   * end. FileOptions.svelte in the Tool's folder sets them on the file's Ready row. Each
   * file starts from `defaultOptions`, and its own values replace the page's when `run`
   * gets the options. Defaults to none.
   */
  fileOptions?: readonly (keyof Options)[];
  /**
   * Why start can't run a file with these options yet, in plain words from `notes`, or
   * nothing. Asked for each chosen file, with its own values in. Defaults to nothing.
   */
  optionsProblem?: (options: Options) => string | undefined;
}

declare const reasonBrand: unique symbol;
/**
 * A failure reason from a declaration's `reasons`, which the banned-words scan reads.
 * ToolFailure takes only this type, so a reason written inside `run` fails the type check.
 */
export type Reason = string & { readonly [reasonBrand]: true };

export type ToolDeclaration<Options extends object = object> = Required<
  Omit<ToolDeclarationInput<Options>, 'reasons'>
> & { reasons: Readonly<Record<string, Reason>> };

/** Fills a reason's `{placeholders}`, keeping it a Reason. */
export function fillReason(reason: Reason, values: Record<string, string | number>): Reason {
  return fillText(reason, values) as Reason;
}

/** Fills a declaration's defaults. */
export function defineTool<Options extends object>(
  input: ToolDeclarationInput<Options>,
): ToolDeclaration<Options> {
  return {
    privacyLine: fillText(text.tool.privacyLine, { noun: input.noun.many }),
    allDone: text.tool.allDone,
    largeFileNote: fillText(text.tool.largeFileNote, { noun: input.noun.one }),
    textFor: () => ({}),
    typeLabel: text.tool.typed.label,
    typeBox: true,
    notes: {},
    fileOptions: [],
    optionsProblem: () => undefined,
    ...input,
    reasons: (input.reasons ?? {}) as Readonly<Record<string, Reason>>,
  };
}

/** The words for these options, with the declaration's own filling any gaps. */
export function wordsFor<Options extends object>(tool: ToolDeclaration<Options>, options: Options) {
  const words = tool.textFor(options);
  return {
    startButton: words.startButton ?? tool.startButton,
    batchLabel: words.batchLabel ?? '',
    allDone: words.allDone ?? tool.allDone,
  };
}

/** Every line a visitor reads from a declaration, for the banned-words scan. */
export function declarationText(tool: ToolDeclaration): string[] {
  return [
    tool.name,
    tool.blurb,
    tool.noun.one,
    tool.noun.many,
    tool.startButton,
    tool.privacyLine,
    tool.allDone,
    tool.largeFileNote,
    ...Object.values(tool.textFor(tool.defaultOptions)),
    tool.typeLabel,
    ...Object.values(tool.reasons),
    ...Object.values(tool.notes),
  ];
}

/** One file a Tool made. */
export interface ToolResult {
  /** The file's bytes. Its type, such as "application/pdf", sets the file extension. */
  blob: Blob;
  /** Added to the file name, as in report_dtb_page3.pdf. */
  detail?: string;
}

/** What shared code hands a Tool's `run` while it works. Tests may leave it out. */
export interface ToolRunContext {
  /**
   * Shows "Getting ready…" until `loading` settles, and passes on its value. For
   * something big that loads only once a file is chosen, such as a library.
   */
  gettingReady<T>(loading: Promise<T>): Promise<T>;
}

/** A line on a chosen file's Ready row, such as how big the result may be. */
export interface ReadyLine {
  text: string;
  /** Shown as a warning, such as a result too big to send. */
  warning?: boolean;
}

/**
 * A Tool's own lines for a chosen file's Ready row, from the file and the options. It
 * runs on the page, before start, so it must stay light: no big libraries. A Tool
 * that has one exports it as `readyNote` from `ready.ts` in its folder.
 */
export type ReadyNote<Options extends object = object> = (
  file: File,
  options: Options,
) => Promise<ReadyLine[]>;

/** A Tool's job for one file (input mode "each"). It may return any number of results. */
export type ToolRun<Options extends object = object> = (
  file: File,
  options: Options,
  context?: ToolRunContext,
) => Promise<ToolResult[]>;

/** A Tool's job for all chosen files at once, in the order set (input mode "together"). */
export type ToolRunTogether<Options extends object = object> = (
  files: File[],
  options: Options,
  context?: ToolRunContext,
) => Promise<ToolResult[]>;

/**
 * Thrown by `run` with a plain-language reason the Tool wrote itself, shown on that
 * row only (one row per file, or one for all files together). Any other error shows
 * the shared fallback.
 */
export class ToolFailure extends Error {
  constructor(public readonly reason: Reason) {
    super(reason);
    this.name = 'ToolFailure';
  }
}

/** A Tool's job for what the person typed (input mode "none"). It returns one result. */
export type ToolTextRun<Options extends object = object> = (
  typed: string,
  options: Options,
) => Promise<ToolResult[]>;
