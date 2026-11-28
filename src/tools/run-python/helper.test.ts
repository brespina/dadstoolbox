// The Python helper (helper.py), run by the same pinned Pyodide package, under Node. One
// instance serves the whole file: Python takes seconds to load.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPyodide } from 'pyodide';
import helper from './helper.py?raw';

let output = { out: '', err: '' };
let runProgram: (code: string) => string;

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
}, 120_000);

/** Runs a Program and returns what it ended with and what it printed. */
function run(code: string) {
  output = { out: '', err: '' };
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
