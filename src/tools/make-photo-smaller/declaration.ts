import { locationDefault, locationText, type LocationOption } from '../../photos/options';
import { fillText, text } from '../../text';
import { defineTool } from '../types';

export type Size = keyof typeof text.photos.sizes;

/** How each size is made: the longest side in pixels, and the JPG quality (0 to 1). */
export const sizes: Record<Size, { longestSide: number; quality: number }> = {
  medium: { longestSide: 2048, quality: 0.82 },
  small: { longestSide: 1280, quality: 0.75 },
  tiny: { longestSide: 800, quality: 0.7 },
};

/** Tried once when a photo comes out no smaller than it went in. */
export const lowerQuality = 0.6;

export type Options = LocationOption & { size: Size };

const sizeName = (options: Options) => text.photos.sizes[options.size].name;

export const tool = defineTool({
  address: 'make-photo-smaller',
  name: 'Make a photo smaller',
  blurb: 'Photo too big to email or send? Make it smaller.',
  category: 'Photos',
  position: 2,
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
  startButton: 'Make smaller',
  textFor: (options: Options) => ({
    ...locationText(options),
    batchLabel: options.removeLocation
      ? sizeName(options)
      : fillText(text.photos.sizeLocationKeptLabel, { size: sizeName(options) }),
  }),
  reasons: {
    heic: text.photos.heicWontOpen,
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: { ...locationDefault, size: 'medium' } as Options,
});
