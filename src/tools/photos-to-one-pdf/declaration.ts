import { defineTool } from '../types';

export const tool = defineTool({
  address: 'photos-to-one-pdf',
  name: 'Photos to one PDF',
  blurb: 'Receipts or pages to send? Put the photos in one PDF, in the order you choose.',
  category: 'PDFs',
  // After Rotate PDF pages (3).
  position: 4,
  noun: { one: 'photo', many: 'photos' },
  // The file type may be empty for an iPhone photo (HEIC), so the endings are listed too.
  accept: [
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/webp',
    '.heic',
    '.heif',
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
  ],
  input: 'together',
  needs: [],
  largeFileLimit: 30_000_000,
  startButton: 'Make one PDF',
  reasons: {
    // {name} is the file's name: several photos make one row, so it says which one.
    heic: "{name} is an iPhone photo (HEIC) that wouldn't open. Choose it again, or try another photo.",
  },
  // Opening photos and drawing them needs the page.
  worker: false,
  outsideAddresses: [],
  defaultOptions: {},
});
