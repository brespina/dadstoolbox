import { videoReasons } from '../../video/reasons';
import { defineTool } from '../types';

export const tool = defineTool({
  address: 'video-to-sound',
  name: 'Get the sound from a video',
  blurb: 'Keep just the sound of a video, such as a song or a voice message.',
  category: 'Video',
  position: 5,
  noun: { one: 'video', many: 'videos' },
  // iPhone videos are .mov, and phones don't always give a file type, so endings are listed too.
  accept: ['video/mp4', 'video/quicktime', 'video/x-m4v', '.mp4', '.mov', '.m4v'],
  input: 'each',
  // The sound is copied as it is, so nothing is played or remade: no browser video features.
  needs: [],
  // Copying is quick, but a phone holds the whole video in memory. About 2 minutes of iPhone 4K.
  largeFileLimit: 500_000_000,
  startButton: 'Get the sound',
  reasons: {
    notVideo: videoReasons.notVideo,
    noSound: 'This video has no sound. Choose a video with sound.',
    cantCopy: "This video's sound can't be saved as an M4A file. Try another video.",
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: {},
});
