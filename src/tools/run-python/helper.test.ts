// The Python helper (helper.py), run by the same pinned Pyodide package, under Node. One
// instance serves the whole file: Python takes seconds to load.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPyodide } from 'pyodide';
import helper from './helper.py?raw';
import { createInputBuffer, createStdin, sendLine, sendStop } from './input-channel';
import { createInterruptBuffer, requestInterrupt } from './interrupt-channel';

let output = { out: '', err: '' };
let runProgram: (code: string) => string;
/** What the Program had printed each time it waited for typing. */
let shownWhenAsked: string[] = [];
/** The lines the next input() calls will get, as the page would send them. */
let typed: string[] = [];
let withBuffer = true;
/** What the page does the next time the Program waits for typing: a line, or Stop. */
let stopAtInput = false;
const interrupt = createInterruptBuffer();

beforeAll(async () => {
  const pyodide = await loadPyodide({ fullStdLib: false });
  const decoder = new TextDecoder();
  pyodide.setStdout({
    write(bytes) {
      output.out += decoder.decode(bytes);
      return bytes.length;
    },
  });
  pyodide.setStderr({
    write(bytes) {
      output.err += decoder.decode(bytes);
      return bytes.length;
    },
  });
  const namespace = pyodide.globals.get('dict')();
  pyodide.runPython(helper, { globals: namespace });
  runProgram = namespace.get('run_program');
  // The worker's wiring for input() (Python's own input() sends what was printed before it
  // waits, which these tests check), with the page's answer sent as soon as it is asked.
  pyodide.setInterruptBuffer(new Uint8Array(interrupt));
  const buffer = createInputBuffer();
  const stdin = (usable: SharedArrayBuffer | undefined) =>
    createStdin(usable, {
      waiting: () => {
        shownWhenAsked.push(output.out);
        if (stopAtInput) {
          // Stop writes the interrupt first, then wakes the wait.
          requestInterrupt(interrupt);
          sendStop(buffer);
        } else sendLine(buffer, typed.shift() ?? '');
      },
      stopped: () => pyodide.checkInterrupt(),
      unavailable: () => shownWhenAsked.push(output.out),
    });
  const withInput = stdin(buffer);
  const withoutInput = stdin(undefined);
  pyodide.setStdin({ stdin: () => (withBuffer ? withInput() : withoutInput()) });
}, 120_000);

/** Runs a Program and returns what it ended with and what it printed. */
function run(code: string) {
  output = { out: '', err: '' };
  shownWhenAsked = [];
  const outcome = runProgram(code);
  return { outcome, ...output };
}

describe('the Python helper', () => {
  it('runs a normal Program and says it ended well', () => {
    expect(run('print("hi")\nprint(1 + 1)')).toEqual({ outcome: 'ok', out: 'hi\n2\n', err: '' });
  });

  it('shows a traceback that starts at the Program, with its line and code', () => {
    const { outcome, err } = run('print("before")\nx = 1 / 0\n');
    expect(outcome).toBe('error');
    expect(err).toContain(
      'Traceback (most recent call last):\n' +
        '  File "main.py", line 2, in <module>\n' +
        '    x = 1 / 0\n',
    );
    expect(err.endsWith('ZeroDivisionError: division by zero\n')).toBe(true);
  });

  it('keeps every frame of the Program and none of the page', () => {
    const { err } = run('def f():\n    raise ValueError("bad")\n\ndef g():\n    f()\n\ng()\n');
    expect(err).toContain('File "main.py", line 7, in <module>');
    expect(err).toContain('File "main.py", line 5, in g');
    expect(err).toContain('File "main.py", line 2, in f');
    expect(err).toContain('ValueError: bad');
    expect(err).not.toMatch(/_pyodide|run_async|helper|<exec>|\bexec\(/);
    // The first frame is the Program's.
    expect(err.split('\n')[1]).toBe('  File "main.py", line 7, in <module>');
  });

  it('shows a syntax error with its line and a caret', () => {
    const { outcome, err } = run('print("ok")\ndef f(:\n    pass\n');
    expect(outcome).toBe('error');
    expect(err).toContain('File "main.py", line 2');
    expect(err).toContain('def f(:');
    expect(err).toMatch(/^ +\^+$/m);
    expect(err).toContain('SyntaxError: invalid syntax');
    expect(err).not.toContain('Traceback');
  });

  it('says a missing module is missing, with nothing about installing it', () => {
    const { outcome, err } = run('import numpy\n');
    expect(outcome).toBe('missingModule');
    expect(err).toContain('File "main.py", line 1, in <module>');
    expect(err).toContain("ModuleNotFoundError: No module named 'numpy'");
    expect(err).not.toMatch(/micropip|loadPackage|install/i);
  });

  it('removes a hint about installing, wherever it comes from', () => {
    const { outcome, err } = run(
      'e = ModuleNotFoundError("No module named \'x\'. Try micropip.install and pyodide.loadPackage", name="x")\n' +
        'e.add_note("You can install it by calling micropip.install")\n' +
        'raise e\n',
    );
    expect(outcome).toBe('missingModule');
    expect(err).toContain("ModuleNotFoundError: No module named 'x'");
    expect(err).not.toMatch(/micropip|loadPackage|install/i);
  });

  it('counts an error inside a module that is there as a plain error', () => {
    const { outcome, err } = run('import json\njson.loads("{")\n');
    expect(outcome).toBe('error');
    expect(err).toContain('JSONDecodeError');
  });

  it('starts every Run fresh', () => {
    run('x = 5');
    expect(run('print(x)').err).toContain("NameError: name 'x' is not defined");
    expect(run('print(__name__)').out).toBe('__main__\n');
  });

  it('ends quietly on sys.exit()', () => {
    expect(run('import sys\nprint("a")\nsys.exit()\nprint("b")')).toEqual({
      outcome: 'ok',
      out: 'a\n',
      err: '',
    });
  });

  it('counts sys.exit with an error code as a failure', () => {
    expect(run('import sys\nsys.exit(2)').outcome).toBe('error');
    const { outcome, err } = run('import sys\nsys.exit("went wrong")');
    expect(outcome).toBe('error');
    expect(err).toBe('went wrong\n');
  });

  it('leaves nothing waiting in Python when a line has no newline', () => {
    expect(run('print("x", end="")')).toEqual({ outcome: 'ok', out: 'x', err: '' });
    expect(run('import sys\nsys.stdout.write("a")\n1/0').out).toBe('a');
    expect(run('print("fine")').out).toBe('fine\n');
  });

  it('works again after an error', () => {
    run('1/0');
    expect(run('print("fine")')).toEqual({ outcome: 'ok', out: 'fine\n', err: '' });
  });
});

describe('input() in a Program', () => {
  it('shows the prompt first, then takes the typed line', () => {
    typed = ['Ada'];
    withBuffer = true;
    const result = run('name = input("Name: ")\nprint("Hello,", name)');
    expect(shownWhenAsked).toEqual(['Name: ']);
    expect(result).toEqual({ outcome: 'ok', out: 'Name: Hello, Ada\n', err: '' });
  });

  it('shows a prompt printed without a newline before it waits', () => {
    typed = ['Ada'];
    run('print("Name: ", end="")\nname = input()');
    expect(shownWhenAsked).toEqual(['Name: ']);
  });

  it('takes three lines in a loop', () => {
    typed = ['a', 'b', 'c'];
    const { out } = run('for i in range(3):\n    print(i, input())');
    expect(out).toBe('0 a\n1 b\n2 c\n');
  });

  it('takes an empty line as an empty answer', () => {
    typed = [''];
    expect(run('print(repr(input()))').out).toBe("''\n");
  });

  it('without a place to wait, ends with EOFError after saying so', () => {
    withBuffer = false;
    const { outcome, err } = run('print("before")\ninput("Name: ")');
    withBuffer = true;
    expect(outcome).toBe('error');
    expect(shownWhenAsked).toEqual(['before\nName: ']);
    expect(err).toContain('File "main.py", line 2, in <module>');
    expect(err.endsWith('EOFError: EOF when reading a line\n')).toBe(true);
  });
});

describe('Stop', () => {
  it('ends a Program that never ends, with no traceback', () => {
    requestInterrupt(interrupt);
    expect(run('while True:\n    pass')).toEqual({ outcome: 'stopped', out: '', err: '' });
    expect(run('print("fine")')).toEqual({ outcome: 'ok', out: 'fine\n', err: '' });
  });

  it('ends a Program that waits at input()', () => {
    stopAtInput = true;
    const result = run('print("Name: ", end="")\nname = input()\nprint("never")');
    stopAtInput = false;
    expect(result).toEqual({ outcome: 'stopped', out: 'Name: ', err: '' });
    expect(run('print("fine")').outcome).toBe('ok');
  });

  it('can be caught like Ctrl-C in Python, and the Program carries on', () => {
    stopAtInput = true;
    const result = run('try:\n    input()\nexcept KeyboardInterrupt:\n    print("caught")');
    stopAtInput = false;
    expect(result).toEqual({ outcome: 'ok', out: 'caught\n', err: '' });
  });

  it('shows a traceback for an error that comes after the interrupt was caught', () => {
    requestInterrupt(interrupt);
    const { outcome, err } = run(
      'try:\n    while True:\n        pass\nexcept KeyboardInterrupt:\n    1 / 0',
    );
    expect(outcome).toBe('error');
    expect(err).toContain('ZeroDivisionError');
  });
});
