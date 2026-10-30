// What `run` can cover in Node: the plain reasons, and the times shown on the Ready row.
// Making the clip needs a browser's video features, so the page tests check the saved file.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { tool } from './declaration';
import { run } from './run';
import { formatTime } from './time';

const sample = () => new File([readFileSync(new URL('sample.mov', import.meta.url))], 'sample.mov');

const reasonFor = async (file: File, options = tool.defaultOptions) => {
  const failure = await run(file, options).catch((e: unknown) => e);
  expect(failure).toBeInstanceOf(ToolFailure);
  return (failure as ToolFailure).reason;
};

describe('Trim a video', () => {
  it('refuses an End that is not after Start, in plain words', async () => {
    expect(await reasonFor(sample(), { start: 0.5, end: 0.5 })).toBe(tool.reasons.endBeforeStart);
    expect(await reasonFor(sample(), { start: 0.5, end: 0.2 })).toBe(tool.reasons.endBeforeStart);
  });

  it('holds start back on the page for the same times, with the same words', () => {
    expect(tool.optionsProblem({ start: 0.5, end: 0.2 })).toBe(tool.reasons.endBeforeStart);
    expect(tool.optionsProblem({ start: 0.2, end: 0.5 })).toBeUndefined();
    // No End set yet means to the end of the video.
    expect(tool.optionsProblem({ start: 0.5, end: null })).toBeUndefined();
  });

  it('says plainly when the browser cannot make the video', async () => {
    // Node has no video features, as on a browser that can't make this video.
    expect(await reasonFor(sample(), { start: 0.2, end: 0.4 })).toBe(tool.reasons.cantMake);
  });

  it('says plainly when the file is not a video', async () => {
    const notVideo = new File(['just some words'], 'notes.mp4', { type: 'video/mp4' });
    expect(await reasonFor(notVideo)).toBe(tool.reasons.notVideo);
  });
});

describe('times on the Ready row', () => {
  it('read as minutes and seconds, to a tenth of a second', () => {
    expect(formatTime(0)).toBe('0:00.0');
    expect(formatTime(1.25)).toBe('0:01.3');
    expect(formatTime(75.04)).toBe('1:15.0');
    expect(formatTime(59.96)).toBe('1:00.0');
    expect(formatTime(3725.5)).toBe('62:05.5');
  });
});
