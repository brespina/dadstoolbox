// Keep this file plain data: plain Node reads it for the browser lock and the page tests.
import { definePracticeTool } from '../types';

export const tool = definePracticeTool({
  address: 'run-python',
  name: 'Run Python',
  blurb: 'Learning Python, or have a small program to try? Write it here and press Run.',
  category: 'Practice',
  position: 3,
  privacyLine: 'Your program stays on your device. It is only kept if you choose.',
  areaLabel: 'Write your program',
  notes: {
    // The Program in the editor the first time the page opens. It only prints.
    starter: [
      '# Press Run to see what this prints.',
      'name = "Python"',
      'print("Hello from", name)',
      '',
      'for number in range(1, 4):',
      '    print("Counting:", number)',
      '',
    ].join('\n'),
    run: 'Run',
    running: 'Running…',
    // The label of the Console, which holds what the Program prints.
    consoleLabel: 'Console',
    consoleEmpty: 'What your program prints appears here.',
    // The page's own words at the end of a Run, apart from what the Program prints.
    done: 'Done.',
    // After Python's own message about a missing module.
    onlyBuiltIn: "Only Python's built-in modules work here.",
    // Read out in front of a line of error output, so it is not told apart by colour alone.
    errorMark: 'Error: ',
    // Shown once at the top of the Console when older lines have been dropped.
    linesRemoved: 'Older lines were removed to keep the page quick.',
    // Why Python is not running, with a button to start it again.
    didNotStart: 'Python could not start on this page.',
    stopped: 'Python stopped unexpectedly.',
    tookTooLong: 'Python is taking too long to start.',
    tryAgain: 'Try again',
  },
});
