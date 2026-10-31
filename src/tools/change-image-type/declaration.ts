import { locationDefault, locationText, type LocationOption } from '../../photos/options';
import { fillText, text } from '../../text';
import { defineTool } from '../types';

export type Format = keyof typeof text.photos.formats;

/** The file type each format is saved as. */
export const formatTypes: Record<Format, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  ico: 'image/x-icon',
};

export type Options = LocationOption & { format: Format };

/** Whether a file of this format can carry the photo's details (date taken, location). */
export const carriesDetails = (format: Format) => format !== 'ico';

const formatName = (options: Options) => text.photos.formats[options.format].name;

export const tool = defineTool({
  address: 'change-image-type',
  name: 'Change image file type',
  blurb: "Picture won't open or send? Change it to a type that does.",
  category: 'Photos',
  position: 1,
  noun: { one: 'image', many: 'images' },
  // The file type may be empty for an iPhone photo (HEIC) or an SVG, so the endings are
  // listed too. GIF is left out on purpose.
  accept: [
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/bmp',
    'image/x-ms-bmp',
    'image/avif',
    'image/svg+xml',
    '.heic',
    '.heif',
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.bmp',
    '.avif',
    '.svg',
  ],
  input: 'each',
  needs: [],
  largeFileLimit: 30_000_000,
  startButton: 'Change to JPG',
  textFor: (options: Options) => {
    // An ICO holds no photo details, so location isn't a choice and isn't claimed.
    const location = carriesDetails(options.format);
    return {
      ...(location ? locationText(options) : {}),
      startButton: fillText(text.photos.startButton, { format: formatName(options) }),
      batchLabel:
        !location || options.removeLocation
          ? formatName(options)
          : fillText(text.photos.locationKeptLabel, { format: formatName(options) }),
    };
  },
  reasons: {
    heic: text.photos.heicWontOpen,
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: { ...locationDefault, format: 'jpg' } as Options,
});
