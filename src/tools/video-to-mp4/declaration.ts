import { videoReasons } from '../../video/reasons';
import { defineTool } from '../types';

export const tool = defineTool({
  address: 'video-to-mp4',
  name: 'Make a video play anywhere (MP4)',
  blurb: 'Save any video as an MP4 that older computers and TVs play.',
  category: 'Video',
  position: 4,
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
  startButton: 'Make an MP4',
  reasons: { ...videoReasons },
  worker: true,
  outsideAddresses: [],
  defaultOptions: {},
});
