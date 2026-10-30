import { defineTool } from '../types';

/** The longest side of the gif, in pixels, for each size. */
export const sizes = { normal: 480, small: 320 } as const;
export type Size = keyof typeof sizes;

export interface Options {
  size: Size;
}

/** Frames a second in the gif. */
export const framesPerSecond = 10;

/** Above about this many bytes, a gif is too big to send easily. */
export const bigGif = 15_000_000;

const smallName = 'Small';

export const tool = defineTool({
  address: 'video-to-gif',
  name: 'Make a gif from a video',
  blurb: 'Turn a short video into a gif to share in chats and email.',
  category: 'Video',
  position: 1,
  noun: { one: 'video', many: 'videos' },
  // iPhone videos are .mov, and phones don't always give a file type, so endings are listed too.
  accept: ['video/mp4', 'video/quicktime', 'video/x-m4v', '.mp4', '.mov', '.m4v'],
  input: 'each',
  needs: ['webcodecs'],
  // About 25 seconds of iPhone video at 1080p.
  largeFileLimit: 60_000_000,
  largeFileNote:
    'This video is big for a phone. It may take a few minutes or stop partway. A shorter clip works better.',
  startButton: 'Make a gif',
  // A Batch made Small says so, as in "Small · 1 video".
  textFor: (options: Options) => ({
    batchLabel: options.size === 'small' ? smallName : '',
  }),
  reasons: {
    notVideo: "This file doesn't look like a video. Choose a video from your phone or computer.",
    cantOpen: "This browser can't open this kind of video. Try another video or another browser.",
  },
  notes: {
    sizeHeading: 'Size',
    normalName: 'Normal',
    normalHint: 'Good for chats and email.',
    smallName,
    smallHint: 'Smaller file. Fine on a phone screen.',
    // {size} is the estimated size, such as "4.2 MB".
    estimate: 'The gif may be up to about {size}.',
    tooBig: "That's big to send. Try a shorter clip, or choose Small.",
  },
  worker: true,
  outsideAddresses: [],
  defaultOptions: { size: 'normal' } as Options,
});
