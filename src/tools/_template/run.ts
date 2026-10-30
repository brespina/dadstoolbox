// The Tool's job, in plain TypeScript. Import heavy libraries here, not in the
// declaration: this file loads only on the Tool's own page.
import { ToolFailure, type ToolRun } from '../types';
import { tool } from './declaration';

/** One copy of the text file, in capitals if that option is ticked. */
export const run: ToolRun<typeof tool.defaultOptions> = async (file, options) => {
  const words = await file.text();
  // A reason the visitor can act on. Any other error shows the shared fallback.
  if (words.length === 0) throw new ToolFailure(tool.reasons.empty!);

  const copy = options.capitals ? words.toUpperCase() : words;
  // The blob's type sets the file extension; the detail is added to the name.
  return [{ blob: new Blob([copy], { type: 'text/plain' }), detail: 'copy' }];
};
