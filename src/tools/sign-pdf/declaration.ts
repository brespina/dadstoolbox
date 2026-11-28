import { text } from '../../text';
import { defineTool } from '../types';

/**
 * One line drawn on the pad without lifting the finger: its points in order, each
 * `[x, y]` as fractions from 0 to 1 of the pad's width and height.
 */
export type Stroke = [x: number, y: number][];

/**
 * The person's Signature (see the glossary), as plain data so options still compare as
 * text. Never stored. #113 adds a typed one.
 */
export type Signature = { kind: 'drawn'; strokes: Stroke[] };

/** The ink every Mark is painted in, by name. #113 adds blue. */
export const inks = { black: '#000000' } as const;
export type Ink = keyof typeof inks;

/** The drawing pad's shape: its width ÷ its height. */
export const padShape = 3;

/**
 * Something put on one page (see the glossary). `page` counts from 1. `x` and `y` are the
 * top-left corner and `width` the width, each a fraction from 0 to 1 of the page as it is
 * shown, with `y` measured down from the top. There is no stored height: it always follows
 * from the picture's shape (ADR-0007).
 */
interface Placed {
  page: number;
  x: number;
  y: number;
  width: number;
}

/** The person's Signature, painted from the page's options. */
export interface SignatureMark extends Placed {
  kind: 'signature';
}

/**
 * A short line of words, kept exactly as typed (any script). Today's date is not a kind of
 * its own: it is a Text Mark filled with the device's short date when it is added.
 */
export interface TextMark extends Placed {
  kind: 'text';
  text: string;
}

export type Mark = SignatureMark | TextMark;

export interface Options {
  signature: Signature;
  ink: Ink;
  /** This PDF's Marks: a file option, so each chosen PDF has its own. */
  marks: Mark[];
}

/** Whether the person has drawn a Signature yet. */
export const hasSignature = (signature: Signature) => signature.strokes.length > 0;

/** Whether there are words to paint: a line of nothing or only spaces is nothing placed. */
export const hasWords = (text: unknown) => typeof text === 'string' && text.trim() !== '';

/** Whether a Mark puts anything on its page: a Text Mark with no words does not. */
export const isFilled = (mark: Mark) => mark.kind !== 'text' || hasWords(mark.text);

// #113 makes the second "Draw or type your signature first." (spec #108).
const nothingPlaced = 'Put your signature or some text on a page first.';
const noSignature = 'Draw your signature first.';

export const tool = defineTool({
  address: 'sign-pdf',
  name: 'Sign a PDF',
  blurb: 'Need to sign a form and send it back? Sign it here.',
  category: 'PDFs',
  // After Photos to one PDF (4).
  position: 5,
  noun: { one: 'PDF', many: 'PDFs' },
  accept: ['application/pdf', '.pdf'],
  input: 'each',
  needs: [],
  largeFileLimit: 100_000_000,
  startButton: 'Sign PDF',
  reasons: {
    password: text.pdfs.password,
    // A signature field that holds a value: saving the PDF again would break that seal.
    digitallySigned:
      'This PDF was already signed digitally, and signing it here would break that seal. Ask the sender for an unsigned copy.',
  },
  notes: {
    nothingPlaced,
    noSignature,
    signatureHeading: 'Your signature',
    padHint: 'Draw it with your finger or mouse.',
    padLabel: 'Signature pad',
    clear: 'Clear',
    // On each chosen PDF's Ready row, over its pages.
    howToPlace:
      'Choose what to add, then tap a page to put it there, or use Add to page. Drag it to move it. On a keyboard, arrows move it (Shift for bigger steps), plus and minus resize it, and Delete removes it.',
    // The choice of what to add: Signature, Text and Today's date.
    addLegend: 'Add',
    // {page} is the page number and {name} the PDF's file name.
    pageLabel: 'Page {page} of {name}',
    addToPage: 'Add to page {page}',
    // What a Mark is called, by kind: its name on the page, before a Signature is drawn,
    // and in its label.
    kindSignature: 'Signature',
    kindText: 'Text',
    kindDate: "Today's date",
    // A Text Mark's box, named like the buttons beside it by `controlLabel`.
    wordsLabel: 'Words',
    // {kind} is the kind's name above.
    markLabel: '{kind} on page {page}',
    smaller: 'Smaller',
    bigger: 'Bigger',
    remove: 'Remove',
    // A chosen Mark's button, named for the Mark it acts on: {action} is the button's
    // words and {mark} the Mark's label.
    controlLabel: '{action}: {mark}',
  },
  // Painting a Mark needs the page's canvas.
  worker: false,
  outsideAddresses: [],
  defaultOptions: {
    signature: { kind: 'drawn', strokes: [] },
    ink: 'black',
    marks: [],
  } as Options,
  fileOptions: ['marks'],
  optionsProblem: ({ signature, marks }) => {
    if (!marks.some(isFilled)) return nothingPlaced;
    if (marks.some((mark) => mark.kind === 'signature') && !hasSignature(signature))
      return noSignature;
    return undefined;
  },
});
