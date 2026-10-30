import { locationDefault, locationText, type LocationOption } from '../../photos/options';
import { fillText, text } from '../../text';
import { defineTool } from '../types';

export type Format = keyof typeof text.photos.formats;

/** The file type each format is saved as. */
export const formatTypes: Record<Format, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export type Options = LocationOption & { format: Format };

const formatName = (options: Options) => text.photos.formats[options.format].name;

export const tool = defineTool({
  address: 'photo-to-jpg',
  name: 'Change a photo to JPG',
  blurb: "iPhone photo won't open or send? Make it a JPG.",
  category: 'Photos',
  position: 1,
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
  input: 'each',
  needs: [],
  largeFileLimit: 30_000_000,
  startButton: 'Change to JPG',
  textFor: (options: Options) => ({
    ...locationText(options),
    startButton: fillText(text.photos.startButton, { format: formatName(options) }),
    batchLabel: options.removeLocation
      ? formatName(options)
      : fillText(text.photos.locationKeptLabel, { format: formatName(options) }),
  }),
  reasons: {
    heic: "This iPhone photo (HEIC) wouldn't open. Choose it again, or try another photo.",
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: { ...locationDefault, format: 'jpg' } as Options,
});
