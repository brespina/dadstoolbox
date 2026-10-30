import { text } from '../../text';
import { defineTool } from '../types';

export const tool = defineTool({
  address: 'remove-photo-location',
  name: 'Remove photo location',
  blurb: 'Sharing a photo? Take out where it was taken first.',
  category: 'Photos',
  position: 3,
  noun: { one: 'photo', many: 'photos' },
  // iPhone photos (HEIC) come in #43.
  accept: ['image/jpeg', '.jpg', '.jpeg'],
  input: 'each',
  needs: [],
  largeFileLimit: 50_000_000,
  startButton: text.photos.removeLocation,
  allDone: text.photos.allDoneLocationRemoved,
  reasons: {
    notCarried: "This kind of photo doesn't carry a location.",
    // Until #43 adds iPhone photos (HEIC) to this Tool.
    heic: "This can't take the location out of an iPhone photo (HEIC) yet. Use Change a photo to JPG with Remove location ticked.",
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: {},
});
