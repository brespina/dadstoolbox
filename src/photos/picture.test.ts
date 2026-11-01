import { describe, expect, it } from 'vitest';
import { fitInSquare } from './picture';

describe('fitInSquare', () => {
  it('fills a square image', () => {
    expect(fitInSquare(100, 100, 32)).toEqual({ x: 0, y: 0, width: 32, height: 32 });
  });

  it('centres a wide image without stretching it', () => {
    expect(fitInSquare(200, 100, 32)).toEqual({ x: 0, y: 8, width: 32, height: 16 });
  });

  it('centres a tall image without stretching it', () => {
    expect(fitInSquare(100, 200, 256)).toEqual({ x: 64, y: 0, width: 128, height: 256 });
  });

  it('enlarges a small image to fit', () => {
    expect(fitInSquare(8, 4, 48)).toEqual({ x: 0, y: 12, width: 48, height: 24 });
  });

  it('keeps a very thin image at least a pixel thick', () => {
    expect(fitInSquare(1000, 1, 16)).toMatchObject({ width: 16, height: 1 });
  });
});
