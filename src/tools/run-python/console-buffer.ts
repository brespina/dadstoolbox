// What the Console holds: the lines a Program has printed, in order. Pure, so Vitest
// tests it; the page (Console.svelte) only shows it.
//
// Output arrives in pieces that don't line up with lines: print("a", end="") sends "a"
// and the next print sends "b\n". The last line stays open until a newline closes it, and
// the next piece continues it. A piece from the other stream (an error in the middle of a
// line) starts a new line instead, so an error never hides inside an ordinary line.
//
// The Console keeps the last `maxLines` lines. When it drops older ones, `removed()` is
// true until the next `clear()`, and the page shows one note about it.

export type Stream = 'stdout' | 'stderr';

export interface ConsoleLine {
  text: string;
  stream: Stream;
}

/** Neighbouring lines of one stream, joined with newlines: what the page draws. */
export interface ConsoleRun {
  text: string;
  stream: Stream;
}

export interface ConsoleBuffer {
  write(text: string, stream: Stream): void;
  clear(): void;
  lines(): ConsoleLine[];
  runs(): ConsoleRun[];
  /** True once older lines have been dropped, until the next `clear()`. */
  removed(): boolean;
}

export const maxConsoleLines = 5000;

export function createConsoleBuffer(maxLines = maxConsoleLines): ConsoleBuffer {
  let lines: ConsoleLine[] = [];
  // Whether the last line is still open: no newline has closed it yet.
  let open = false;
  let removed = false;

  return {
    write(text, stream) {
      const parts = text.split('\n');
      parts.forEach((part, i) => {
        const last = lines.at(-1);
        if (open && last && last.stream === stream) {
          last.text += part;
        } else if (part !== '' || i < parts.length - 1) {
          lines.push({ text: part, stream });
        } else {
          return;
        }
        // Every part but the last was ended by a newline.
        open = i === parts.length - 1;
      });
      if (lines.length > maxLines) {
        lines = lines.slice(lines.length - maxLines);
        removed = true;
      }
    },
    clear() {
      lines = [];
      open = false;
      removed = false;
    },
    lines: () => lines.map((line) => ({ ...line })),
    runs() {
      const runs: ConsoleRun[] = [];
      lines.forEach((line, i) => {
        // A closed line ends in a newline; the open last line doesn't.
        const text = i === lines.length - 1 && open ? line.text : `${line.text}\n`;
        const run = runs.at(-1);
        if (run && run.stream === line.stream) run.text += text;
        else runs.push({ text, stream: line.stream });
      });
      return runs;
    },
    removed: () => removed,
  };
}
