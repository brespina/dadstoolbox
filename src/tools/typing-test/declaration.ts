// Keep this file plain data: plain Node reads it for the browser lock and the page tests.
import { definePracticeTool } from '../types';

export const tool = definePracticeTool({
  address: 'typing-test',
  name: 'Typing test',
  blurb: 'See how fast you type, and get faster with practice.',
  category: 'Practice',
  position: 1,
  privacyLine: 'What you type stays on your device. Nothing is kept.',
  areaLabel: 'Type the words',
  notes: {
    start: 'Click or press any key to start',
    // The settings bar.
    test: 'Test',
    time: 'Time',
    words: 'Words',
    seconds: 'Seconds',
    restart: 'Restart',
    restartHint: 'Or press Tab, then Enter.',
    // Read out when the test ends.
    done: 'Test done. {wpm} words per minute. {accuracy}% right.',
    // The results.
    wpm: 'Words per minute',
    accuracy: 'Accuracy',
    percent: '{accuracy}%',
    rawWpm: 'Raw words per minute',
    rawHint: 'Raw counts every key you pressed, mistakes too.',
    lettersRight: 'Letters right',
    lettersWrong: 'Letters wrong',
    lettersExtra: 'Extra letters',
    lettersMissed: 'Letters missed',
    testTime: '{seconds} seconds',
    testWords: '{count} words',
  },
});
