import { videoReasons } from '../../video/reasons';
import { defineTool } from '../types';

/** The longest side of the saved video, in pixels, for each size. */
export const sizes = { smaller: 720, smallest: 480 } as const;
export type Size = keyof typeof sizes;

export interface Options {
  size: Size;
}

/** Above about this many bytes, a video is too big to send easily. */
export const bigVideo = 25_000_000;

const smallerName = 'Smaller';
const smallestName = 'Smallest';

export const tool = defineTool({
  address: 'make-video-smaller',
  name: 'Make a video smaller',
  blurb: 'Video too big to text or email? Make it smaller.',
  category: 'Video',
  position: 2,
  noun: { one: 'video', many: 'videos' },
  // iPhone videos are .mov, and phones don't always give a file type, so endings are listed too.
  accept: [
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
    'video/webm',
    '.mp4',
    '.mov',
    '.m4v',
    '.webm',
  ],
  input: 'each',
  needs: ['webcodecs', 'makeVideo'],
  // Provisional: Make a gif's limit. The real-phone tries set the final number.
  largeFileLimit: 60_000_000,
  largeFileNote:
    'This video is big for a phone. It may take a few minutes or stop partway. A shorter clip works better.',
  startButton: 'Make smaller',
  // The Batch names the size, as in "Smallest · 1 video".
  textFor: (options: Options) => ({
    batchLabel: options.size === 'smallest' ? smallestName : smallerName,
  }),
  reasons: { ...videoReasons },
  notes: {
    sizeHeading: 'Size',
    smallerName,
    smallerHint: 'Good for texts and email.',
    smallestName,
    smallestHint: 'Smallest file. Fine on a phone screen.',
    // {size} is the estimated size, such as "4.2 MB".
    estimate: 'The video may be about {size}.',
    tooBig: "That's big to send. Try a shorter clip, or choose Smallest.",
    tooBigSmallest: "That's big to send. Try a shorter clip.",
  },
  worker: true,
  outsideAddresses: [],
  defaultOptions: { size: 'smaller' } as Options,
});
