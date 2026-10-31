// Running a Tool's `run` once: naming what it made, or turning its failure into a plain
// reason (batch.ts and typed.ts), and the context a run reports through (batch.ts and
// worker.ts).

import { ToolFailure, wholePercent, type ToolResult, type ToolRunContext } from './types';

/** A result named and ready to save. */
export interface NamedFile {
  name: string;
  size: number;
  blob: Blob;
}

/** What one run gave: its named files, or why it didn't work. */
export type RunOutcome = { files: NamedFile[] } | { reason: string };

/**
 * Names no result may take, such as chosen files' names and earlier results. Kept in
 * lower case: phones and Macs treat Report.PDF and report.pdf as one file.
 */
export interface TakenNames {
  take(name: string): void;
  has(name: string): boolean;
}

export function createTakenNames(): TakenNames {
  const names = new Set<string>();
  return {
    take: (name) => void names.add(name.toLowerCase()),
    has: (name) => names.has(name.toLowerCase()),
  };
}

export interface RunNaming {
  /** The original's name, such as IMG_1234.HEIC. Results are named after it. */
  original: string;
  /** Names to avoid. A result gets _2, _3 instead, and its name is taken in turn. */
  taken?: TakenNames;
  /** Shown when `run` fails without a reason of its own. */
  fallback: string;
  /** Labels the console log for an unexpected error, such as the Tool's name. */
  logAs: string;
}

/** The extension for each type a Tool can make. */
const extensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'audio/mp4': 'm4a',
};

function splitName(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot + 1) } : { base: name, ext: '' };
}

/**
 * Runs `work` (one call to a Tool's `run`) and names what it made. A failure gives the
 * Tool's own reason, or `fallback` with the detail logged to the console; it never throws.
 */
export async function runOnce(
  work: () => Promise<ToolResult[]>,
  { original, taken, fallback, logAs }: RunNaming,
): Promise<RunOutcome> {
  let results: ToolResult[];
  try {
    results = await work();
  } catch (error) {
    if (error instanceof ToolFailure) return { reason: error.reason };
    console.error(logAs, error);
    return { reason: fallback };
  }
  const { base, ext: originalExt } = splitName(original);
  return {
    files: results.map((result) => {
      const ext = extensions[result.blob.type] ?? originalExt;
      const stem = `${base}_dtb${result.detail ? `_${result.detail}` : ''}`;
      const dotExt = ext ? `.${ext}` : '';
      let name = `${stem}${dotExt}`;
      for (let n = 2; taken?.has(name); n++) name = `${stem}_${n}${dotExt}`;
      taken?.take(name);
      return {
        name,
        size: result.blob.size,
        blob: result.blob,
      };
    }),
  };
}

/** Where a run context's reports go. */
export interface RunReports {
  /** How far along the file is, from 0 to 1. Called only when the whole percent changes. */
  progress(fraction: number): void;
  /** Loading started (true), or every overlapping load has settled (false). */
  loading(on: boolean): void;
}

/** The context for one run, handed to a Tool's `run`. */
export function runContext(reports: RunReports): ToolRunContext {
  let shown: number | undefined;
  let loads = 0;
  return {
    progress(fraction) {
      const percent = wholePercent(fraction);
      if (percent === shown) return;
      shown = percent;
      reports.progress(fraction);
    },
    async gettingReady(loading) {
      if (loads++ === 0) reports.loading(true);
      try {
        return await loading;
      } finally {
        if (--loads === 0) reports.loading(false);
      }
    },
  };
}
