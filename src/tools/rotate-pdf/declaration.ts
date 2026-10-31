import { text } from '../../text';
import { defineTool } from '../types';

/** How far each choice turns a page, clockwise, in degrees. */
export const turns = { right: 90, left: 270, upsideDown: 180 } as const;
export type Turn = keyof typeof turns;

export interface Options {
  turn: Turn;
}

const turnWords: Record<Turn, string> = {
  right: 'Turn right',
  left: 'Turn left',
  upsideDown: 'Turn upside down',
};

export const tool = defineTool({
  address: 'rotate-pdf',
  name: 'Rotate PDF pages',
  blurb: 'Pages sideways or upside down? Turn them the right way.',
  category: 'PDFs',
  position: 3,
  noun: { one: 'PDF', many: 'PDFs' },
  accept: ['application/pdf', '.pdf'],
  input: 'each',
  needs: [],
  largeFileLimit: 100_000_000,
  startButton: turnWords.right,
  // The start button and the Batch label both say which way, as in "Turn left · 2 PDFs".
  textFor: (options: Options) => ({
    startButton: turnWords[options.turn],
    batchLabel: turnWords[options.turn],
  }),
  reasons: {
    password: text.pdfs.password,
  },
  notes: {
    turnHeading: 'Which way',
    rightName: turnWords.right,
    leftName: turnWords.left,
    upsideDownName: turnWords.upsideDown,
  },
  worker: false,
  outsideAddresses: [],
  defaultOptions: { turn: 'right' } as Options,
});
