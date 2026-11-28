import { describe, expect, it } from 'vitest';
import { createConsoleBuffer } from './console-buffer';

describe('console buffer', () => {
  it('splits what is written into lines', () => {
    const buffer = createConsoleBuffer();
    buffer.write('one\ntwo\n', 'stdout');
    expect(buffer.lines()).toEqual([
      { text: 'one', stream: 'stdout' },
      { text: 'two', stream: 'stdout' },
    ]);
  });

  it('keeps a partial line open for the next chunk', () => {
    const buffer = createConsoleBuffer();
    buffer.write('a', 'stdout');
    expect(buffer.lines()).toEqual([{ text: 'a', stream: 'stdout' }]);
    buffer.write('b\n', 'stdout');
    expect(buffer.lines()).toEqual([{ text: 'ab', stream: 'stdout' }]);
    buffer.write('c', 'stdout');
    expect(buffer.lines().map((line) => line.text)).toEqual(['ab', 'c']);
  });

  it('keeps empty lines', () => {
    const buffer = createConsoleBuffer();
    buffer.write('a\n\nb\n', 'stdout');
    expect(buffer.lines().map((line) => line.text)).toEqual(['a', '', 'b']);
  });

  it('starts a new line when the stream changes mid-line', () => {
    const buffer = createConsoleBuffer();
    buffer.write('a', 'stdout');
    buffer.write('oops\n', 'stderr');
    expect(buffer.lines()).toEqual([
      { text: 'a', stream: 'stdout' },
      { text: 'oops', stream: 'stderr' },
    ]);
  });

  it("puts the page's own words on a line of their own, after an open line", () => {
    const buffer = createConsoleBuffer();
    buffer.write('a', 'stdout');
    buffer.write('Done.\n', 'note');
    expect(buffer.runs()).toEqual([
      { text: 'a\n', stream: 'stdout' },
      { text: 'Done.\n', stream: 'note' },
    ]);
  });

  it('groups neighbouring lines of one stream into runs', () => {
    const buffer = createConsoleBuffer();
    buffer.write('a\nb\n', 'stdout');
    buffer.write('x\ny\n', 'stderr');
    buffer.write('c', 'stdout');
    expect(buffer.runs()).toEqual([
      { text: 'a\nb\n', stream: 'stdout' },
      { text: 'x\ny\n', stream: 'stderr' },
      { text: 'c', stream: 'stdout' },
    ]);
  });

  it('clears everything, including the note', () => {
    const buffer = createConsoleBuffer(2);
    buffer.write('1\n2\n3\n4\n', 'stdout');
    expect(buffer.removed()).toBe(true);
    buffer.clear();
    expect(buffer.lines()).toEqual([]);
    expect(buffer.removed()).toBe(false);
  });

  it('holds the last 5,000 lines of 20,000, and says once that it dropped some', () => {
    const buffer = createConsoleBuffer();
    expect(buffer.removed()).toBe(false);
    let chunk = '';
    for (let i = 0; i < 20_000; i += 1) chunk += `line ${i}\n`;
    // Written in pieces, as the page gets it.
    for (let i = 0; i < chunk.length; i += 1000) buffer.write(chunk.slice(i, i + 1000), 'stdout');
    const lines = buffer.lines();
    expect(lines).toHaveLength(5000);
    expect(lines[0]!.text).toBe('line 15000');
    expect(lines.at(-1)!.text).toBe('line 19999');
    expect(buffer.removed()).toBe(true);
  });
});
