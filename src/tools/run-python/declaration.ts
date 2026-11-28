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
    // Under the editor, because Tab indents there and would otherwise trap the keyboard.
    leaveEditor: 'To leave the editor with the keyboard, press Escape, then Tab.',
    run: 'Run',
    running: 'Running…',
    stop: 'Stop',
    // Empties the Console, so the next thing printed starts on a clean screen.
    clear: 'Clear the Console',
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
    // In the Console, after Stop (in place of a traceback for the interrupt).
    stoppedLine: 'Stopped.',
    // In the Console, when Python ended on its own, as when a program uses all the memory.
    died: 'The program stopped working. It may have used too much memory. Press Run to try again.',
    // Choose a .py file in, Save the Program out. {name} is the chosen file's name.
    choose: 'Choose a .py file',
    save: 'Save',
    chosen: 'Opened {name}. Undo brings your last program back.',
    // Why a chosen file was not used; the Program stays as it was.
    notAProgram: "That file isn't a program. Choose a .py file.",
    tooBig: 'That file is too big for a program.',
    couldNotRead: 'That file could not be read. Try choosing it again.',
    // Keep (#132, ADR-0011): the choice above the editor, and what each option does.
    keepLegend: 'Keeping your program',
    neverKeep: 'Never keep',
    keepProgram: 'Keep my program in this browser',
    neverKeepWords: 'Your program is gone when you close this page. Use Save to keep a file.',
    keepWords: 'Your program stays in this browser only. It is never sent anywhere.',
    // Shown when Keep was chosen but the browser would not store it; the choice goes back.
    cannotKeep: "This browser won't keep your program here.",
    // Why Python is not running, with a button to start it again.
    didNotStart: 'Python could not start on this page.',
    tookTooLong: 'Python is taking too long to start.',
    tryAgain: 'Try again',
    // The typing field that appears in the Console when the Program calls input().
    typeAnswer: 'Type your answer',
    // In the Console, when the Program calls input() where this browser can't wait for typing.
    noInput:
      "input() doesn't work here. This browser can't wait for you to type. Programs that don't use input() still work.",
    // Shown near Run when this browser can't make the page wait for typing (ADR-0009).
    noIsolation:
      "This browser can't ask you to type while a program runs. Programs that don't use input() still work.",
  },
});
