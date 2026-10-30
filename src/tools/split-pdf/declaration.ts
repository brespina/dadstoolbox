import { defineTool } from '../types';

export const tool = defineTool({
  address: 'split-pdf',
  name: 'Split a PDF',
  blurb: 'Need just some of the pages? Get each page as its own PDF.',
  category: 'PDFs',
  position: 2,
  noun: { one: 'PDF', many: 'PDFs' },
  accept: ['application/pdf', '.pdf'],
  input: 'each',
  needs: [],
  largeFileLimit: 100_000_000,
  startButton: 'Split into pages',
  reasons: {
    password: 'This PDF has a password. Remove it and try again.',
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: {},
});
