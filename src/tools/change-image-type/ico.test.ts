import { describe, expect, it } from 'vitest';
import { fitInSquare, makeIco } from './ico';

describe('makeIco', () => {
  it('lays out a directory, then each picture, with 256 written as 0', () => {
    const small = new Uint8Array([1, 2, 3]);
    const big = new Uint8Array([4, 5, 6, 7, 8]);
    const file = makeIco([
      { size: 16, png: small },
      { size: 256, png: big },
    ]);
    const view = new DataView(file.buffer);
    expect([...file.subarray(0, 6)]).toEqual([0, 0, 1, 0, 2, 0]);
    // First entry: 16 × 16, one plane, 32 bits, 3 bytes at offset 38.
    expect([...file.subarray(6, 10)]).toEqual([16, 16, 0, 0]);
    expect([view.getUint16(10, true), view.getUint16(12, true)]).toEqual([1, 32]);
    expect([view.getUint32(14, true), view.getUint32(18, true)]).toEqual([3, 38]);
    // Second entry: width and height 0 mean 256, and it starts right after the first.
    expect([...file.subarray(22, 24)]).toEqual([0, 0]);
    expect([view.getUint32(30, true), view.getUint32(34, true)]).toEqual([5, 41]);
    expect([...file.subarray(38)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

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
