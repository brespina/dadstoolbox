import { text } from '../../text';
import { defineTool } from '../types';

export const tool = defineTool({
  address: 'remove-photo-location',
  name: 'Remove photo location',
  blurb: 'Sharing a photo? Take out where it was taken first.',
  category: 'Photos',
  position: 3,
  noun: { one: 'photo', many: 'photos' },
  accept: ['image/heic', 'image/heif', 'image/jpeg', '.heic', '.heif', '.jpg', '.jpeg'],
  input: 'each',
  needs: [],
  largeFileLimit: 50_000_000,
  startButton: text.photos.removeLocation,
  allDone: text.photos.allDoneLocationRemoved,
  reasons: {
    notCarried: "This kind of photo doesn't carry a location.",
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: {},
});
