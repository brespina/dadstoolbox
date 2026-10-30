// The Tool module contract. Each Tool folder in src/tools holds:
// - declaration.ts: plain data made with defineTool (no Svelte, no libraries,
//   because plain Node reads it too: the browser lock and the generated page test)
// - run.ts: exports `run`, the Tool's job, in plain TypeScript
// - Options.svelte: the Tool's options, bound to an options object
// - sample.<ext>: the file the generated page test chooses
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
export type BrowserFeature = 'webcodecs';

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
  needs: readonly BrowserFeature[];
  /** Files bigger than this (in bytes) get a note on their Ready row. */
  largeFileLimit: number;
  /** Words on the start button, saying what will happen. */
  startButton: string;
  /** Defaults to the Promise line with the Tool's noun swapped in. */
  privacyLine?: string;
  /** Shown when a Batch finishes. */
  allDone?: string;
  /** The Tool's own plain-language failure reasons, thrown by `run` as ToolFailure. */
  reasons?: Readonly<Record<string, string>>;
  /** Whether `run` runs in a Web Worker. */
  worker: boolean;
  /** Outside origins the Tool may contact. They widen the browser lock. */
  outsideAddresses: readonly string[];
  defaultOptions: Options;
}

export type ToolDeclaration<Options extends object = object> = Required<
  ToolDeclarationInput<Options>
>;

/** Fills a declaration's defaults. */
export function defineTool<Options extends object>(
  input: ToolDeclarationInput<Options>,
): ToolDeclaration<Options> {
  return {
    privacyLine: fillText(text.tool.privacyLine, { noun: input.noun.many }),
    allDone: text.tool.allDone,
    reasons: {},
    ...input,
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
    ...Object.values(tool.reasons),
  ];
}

/** One file a Tool made. */
export interface ToolResult {
  /** The file's bytes. Its type, such as "application/pdf", sets the file extension. */
  blob: Blob;
  /** Added to the file name, as in report_dtb_page3.pdf. */
  detail?: string;
}

/** A Tool's job for one file (input mode "each"). It may return any number of results. */
export type ToolRun<Options extends object = object> = (
  file: File,
  options: Options,
) => Promise<ToolResult[]>;

/**
 * Thrown by `run` with a plain-language reason the Tool wrote itself, shown on that
 * file's row. Any other error shows the shared fallback.
 */
export class ToolFailure extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'ToolFailure';
  }
}
