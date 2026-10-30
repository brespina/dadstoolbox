import { defineTool } from '../types';

export const tool = defineTool({
  address: 'combine-pdfs',
  name: 'Combine PDFs',
  blurb: 'Several PDFs to send? Put them together as one PDF, in the order you choose.',
  category: 'PDFs',
  position: 1,
  noun: { one: 'PDF', many: 'PDFs' },
  accept: ['application/pdf', '.pdf'],
  input: 'together',
  needs: [],
  largeFileLimit: 100_000_000,
  startButton: 'Combine PDFs',
  reasons: {
    password: 'This PDF has a password. Remove it and try again.',
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: {},
});
