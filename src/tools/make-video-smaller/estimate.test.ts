import { describe, expect, it } from 'vitest';
import { wordsFor } from '../types';
import { tool } from './declaration';
import { readyLines } from './estimate';

describe('the size estimate on the Ready row', () => {
  it('says about how big a minute of phone video will be at Smaller', () => {
    // 720 × 406 at about 0.95 Mbps, plus the sound: about 8.1 MB a minute.
    expect(readyLines({ width: 1280, height: 720, duration: 60 }, { size: 'smaller' })).toEqual([
      { text: 'The video may be about 8.1 MB.' },
    ]);
  });

  it('is smaller at Smallest, and the same for a tall video', () => {
    // 270 × 480 at about 0.44 Mbps, plus the sound.
    expect(readyLines({ width: 1080, height: 1920, duration: 60 }, { size: 'smallest' })).toEqual([
      { text: 'The video may be about 4.3 MB.' },
    ]);
  });

  it('warns when the video will still be big to send', () => {
    expect(readyLines({ width: 1920, height: 1080, duration: 200 }, { size: 'smaller' })).toEqual([
      { text: 'The video may be about 27 MB.' },
      { text: "That's big to send. Try a shorter clip, or choose Smallest.", warning: true },
    ]);
  });

  it('at Smallest, only suggests a shorter clip', () => {
    const lines = readyLines({ width: 1920, height: 1080, duration: 400 }, { size: 'smallest' });
    expect(lines[1]).toEqual({ text: "That's big to send. Try a shorter clip.", warning: true });
  });

  it('never estimates a small video as made larger', () => {
    // 320 × 180 stays that size at Smaller and Smallest alike.
    const small = { width: 320, height: 180, duration: 60 };
    expect(readyLines(small, { size: 'smaller' })).toEqual(readyLines(small, { size: 'smallest' }));
  });
});

describe('the Batch label', () => {
  it('names the size', () => {
    expect(wordsFor(tool, { size: 'smaller' }).batchLabel).toBe('Smaller');
    expect(wordsFor(tool, { size: 'smallest' }).batchLabel).toBe('Smallest');
  });
});
