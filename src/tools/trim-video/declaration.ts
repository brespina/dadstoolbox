import { videoReasons } from '../../video/reasons';
import { defineTool } from '../types';

const endBeforeStart = 'End must come after Start. Move End later, or Start earlier.';

export const tool = defineTool({
  address: 'trim-video',
  name: 'Trim a video',
  blurb: 'Keep only the part of a video you want, cut exactly.',
  category: 'Video',
  position: 3,
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
  // Provisional, and higher than the other video Tools: only the part kept is remade.
  // The real-phone tries set the final number.
  largeFileLimit: 200_000_000,
  largeFileNote:
    'This video is big for a phone. It may take a few minutes or stop partway. A shorter clip works better.',
  startButton: 'Trim',
  reasons: { ...videoReasons, endBeforeStart },
  notes: {
    howTo: 'Play the video and pause it where you want. Then press Set Start or Set End.',
    start: 'Start: {time}',
    end: 'End: {time}',
    toTheEnd: 'End: the end of the video',
    setStart: 'Set Start to now',
    setEnd: 'Set End to now',
    // {name} is the video's file name, so each button's name is its own.
    setStartLabel: 'Set Start to now for {name}',
    setEndLabel: 'Set End to now for {name}',
    previewLabel: 'Preview of {name}',
    length: 'The clip will be {time} long.',
  },
  worker: true,
  outsideAddresses: [],
  // Start and End, in seconds, belong to each video. End null means to the end.
  defaultOptions: { start: 0, end: null as number | null },
  fileOptions: ['start', 'end'],
  optionsProblem: ({ start, end }) => (end !== null && end <= start ? endBeforeStart : undefined),
});

export type Options = typeof tool.defaultOptions;
