import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tool } from './declaration';
import {
  maxProgramBytes,
  programFileName,
  pyodideFolder,
  pyodideVersion,
  readProgram,
  tooBigToRead,
} from './files';

it('serves the version of Pyodide that is installed', () => {
  const installed = JSON.parse(
    readFileSync(new URL('../../../node_modules/pyodide/package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  expect(pyodideVersion).toBe(installed.version);
  expect(pyodideFolder).toBe(`run-python/pyodide/${installed.version}`);
});

describe('the saved file name', () => {
  it.each([
    ['hello.py', 'hello.py'],
    ['C:\\Users\\Sam\\Code\\hello.py', 'hello.py'],
    ['/home/sam/code/hello.py', 'hello.py'],
    ['Hello.PY', 'Hello.py'],
    ['notes.txt', 'notes.py'],
    ['my script', 'my script.py'],
    ['v1.2', 'v1.2.py'],
    ['a<b>:c"d|e?f*g.py', 'abcdefg.py'],
    ['tab\tname\u0000.py', 'tabname.py'],
    ['  spaced.  ', 'spaced.py'],
    ['CON.py', '_CON.py'],
    ['.py', 'my-program.py'],
    ['///', 'my-program.py'],
  ])('names %j as %j', (chosen, saved) => {
    expect(programFileName(chosen)).toBe(saved);
  });

  it('is my-program.py when no file was chosen', () => {
    expect(programFileName(undefined)).toBe('my-program.py');
    expect(programFileName('')).toBe('my-program.py');
  });

  it('keeps a long name short enough for a device', () => {
    const saved = programFileName(`${'a'.repeat(400)}.py`);
    expect(saved.endsWith('.py')).toBe(true);
    expect(saved.length).toBeLessThanOrEqual(100);
  });
});

describe('reading a chosen file', () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  const encode = (value: string) => new TextEncoder().encode(value);

  it('reads plain text, with accents and emoji', () => {
    expect(readProgram(encode('print("café 🐍")\n'))).toEqual({
      ok: true,
      text: 'print("café 🐍")\n',
    });
  });

  it('reads an empty file as an empty Program', () => {
    expect(readProgram(bytes())).toEqual({ ok: true, text: '' });
  });

  it('drops a byte order mark at the start', () => {
    expect(readProgram(bytes(0xef, 0xbb, 0xbf, 0x78))).toEqual({ ok: true, text: 'x' });
  });

  it('refuses bytes that are not text', () => {
    expect(readProgram(bytes(0x78, 0xff, 0xfe, 0x79))).toEqual({
      ok: false,
      reason: tool.notes.notAProgram,
    });
  });

  it('refuses a NUL byte', () => {
    expect(readProgram(bytes(0x78, 0x00, 0x79))).toEqual({
      ok: false,
      reason: tool.notes.notAProgram,
    });
  });

  it('takes a file of exactly the biggest size, and refuses one byte more', () => {
    const atCap = new Uint8Array(maxProgramBytes).fill(0x78);
    expect(readProgram(atCap)).toMatchObject({ ok: true });
    expect(readProgram(new Uint8Array(maxProgramBytes + 1).fill(0x78))).toEqual({
      ok: false,
      reason: tool.notes.tooBig,
    });
  });

  it('judges size from the number alone, so a big file need not be read', () => {
    expect(tooBigToRead(maxProgramBytes)).toBe(false);
    expect(tooBigToRead(maxProgramBytes + 1)).toBe(true);
  });
});
