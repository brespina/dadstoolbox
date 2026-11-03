// Keep this file plain data: plain Node reads it for the browser lock and the page tests.
import { definePracticeTool } from '../types';

export const tool = definePracticeTool({
  address: 'vim-practice',
  name: 'Vim practice',
  blurb: 'Learn to move around text with Vim’s keys, in as few key presses as you can.',
  category: 'Practice',
  position: 2,
  privacyLine: 'What you type stays on your device. Nothing is kept.',
  areaLabel: 'Move the cursor with Vim keys',
  notes: {
    lesson: 'Lesson',
    start: 'Click or press any key to start',
    goal: 'Move the cursor to the marked character.',
    // Shown when a key isn't one of the Lesson's motions.
    ignored: '{key} isn’t a motion in this Lesson.',
    space: 'Space',
    allowed: 'Keys in this Lesson',
    countHint: 'Type a number first to repeat a motion, as in 3j. Escape cancels it.',
    needsKeyboard:
      'Vim practice needs a keyboard. Connect one to this phone or tablet, or come back on a computer.',
    // Read by screen readers with the practice area.
    where: 'Cursor on line {line}, column {col}. Target on line {targetLine}, column {targetCol}.',
    // Read out when the round ends.
    done: 'Round done in {seconds} seconds, with {presses} key presses. The fewest possible was {fewest}.',
    // The results.
    time: 'Time',
    seconds: '{seconds} s',
    presses: 'Key presses',
    fewest: 'Fewest possible',
    mostExtra: 'Drills with the most extra keys',
    drillExtra: 'Drill {number}: {presses} keys, {extra} more than the fewest',
    noExtra: 'You used the fewest keys in every Drill.',
    newRound: 'New round',
    restartHint: 'Or press Tab, then Enter.',
  },
});
