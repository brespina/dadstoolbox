// The template Tool. Copy this folder to start a new Tool; see docs/adding-a-tool.md.
// Folders starting with "_" are skipped, so this never shows on the Site.
//
// Keep this file plain data: no Svelte, CSS or library imports. Plain Node reads it
// for the browser lock and the generated page test.
import { defineTool } from '../types';

export const tool = defineTool({
  // Must match this folder's name and the page file, src/pages/<address>.astro.
  address: 'template',
  // A task, in everyday words.
  name: 'Copy a text file',
  blurb: 'Get a copy of a text file, in capitals if you like.',
  category: 'Other',
  // Unique within the Category; lowest is listed first.
  position: 99,
  noun: { one: 'text file', many: 'text files' },
  accept: ['text/plain', '.txt'],
  // 'each' (each file on its own), 'together' (all files together) or 'none' (no file).
  input: 'each',
  // Browser features `run` needs, such as 'webcodecs'.
  needs: [],
  // In bytes. Bigger files get a note on their Ready row.
  largeFileLimit: 10_000_000,
  startButton: 'Make copies',
  // Optional: privacyLine and allDone have defaults.
  // Plain-language reasons `run` may throw as ToolFailure.
  reasons: {
    empty: 'This file is empty. Choose a file with some text in it.',
  },
  // true runs `run` in a Web Worker, so it can't touch the page.
  worker: false,
  // Outside origins the Tool contacts. Keep this empty; see the guide first.
  outsideAddresses: [],
  defaultOptions: { capitals: false },
});
