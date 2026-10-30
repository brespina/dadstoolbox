import { describe, expect, it } from 'vitest';
import { fitLongestSide } from './size';

describe('fitting a video to a longest side', () => {
  it('makes a wide video that wide, the height following', () => {
    expect(fitLongestSide({ width: 1280, height: 720 }, 720)).toEqual({
      set: { width: 720 },
      size: { width: 720, height: 406 },
    });
  });

  it('makes a tall video that tall, the width following', () => {
    expect(fitLongestSide({ width: 360, height: 640 }, 480)).toEqual({
      set: { height: 480 },
      size: { width: 270, height: 480 },
    });
  });

  it('never makes a video larger', () => {
    expect(fitLongestSide({ width: 360, height: 640 }, 720)).toEqual({
      set: {},
      size: { width: 360, height: 640 },
    });
  });

  it('keeps the size with no longest side', () => {
    expect(fitLongestSide({ width: 1920, height: 1080 })).toEqual({
      set: {},
      size: { width: 1920, height: 1080 },
    });
  });
});
