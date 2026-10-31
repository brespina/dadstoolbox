import { describe, expect, it } from 'vitest';
import { sizeSvg } from './svg';

const ns = 'xmlns="http://www.w3.org/2000/svg"';
const size = (root: string) => {
  const { width, height } = sizeSvg(`<svg ${ns} ${root}><rect width="1" height="1"/></svg>`);
  return [width, height];
};

describe('sizeSvg', () => {
  it('uses a stated width and height', () => {
    expect(size('width="40" height="30"')).toEqual([40, 30]);
    expect(size('width="40px" height="30.4px" viewBox="0 0 8 6"')).toEqual([40, 30]);
  });

  it('turns other absolute units into pixels', () => {
    expect(size('width="1in" height="0.5in"')).toEqual([96, 48]);
    expect(size('width="30pt" height="3pc"')).toEqual([40, 48]);
    expect(size('width="25.4mm" height="2.54cm"')).toEqual([96, 96]);
  });

  it('draws one with only a viewBox 1024 wide, keeping its shape', () => {
    expect(size('viewBox="0 0 40 30"')).toEqual([1024, 768]);
    expect(size('viewBox="10,20,100,50"')).toEqual([1024, 512]);
  });

  it("treats a size that isn't absolute as not stated", () => {
    expect(size('width="100%" height="100%" viewBox="0 0 40 30"')).toEqual([1024, 768]);
    expect(size('width="auto" height="2em" viewBox="0 0 40 30"')).toEqual([1024, 768]);
    expect(size('width="40" viewBox="0 0 40 30"')).toEqual([1024, 768]);
    expect(size('width="0" height="0" viewBox="0 0 40 30"')).toEqual([1024, 768]);
  });

  it('draws one with no size at all 1024 wide in the browsers’ 2:1 shape', () => {
    expect(size('')).toEqual([1024, 512]);
    expect(size('viewBox="0 0 0 0"')).toEqual([1024, 512]);
  });

  it('puts the size on the picture so the browser draws it at that size', () => {
    const { markup } = sizeSvg(`<svg ${ns} viewBox="0 0 40 30"><rect/></svg>`);
    expect(markup).toContain('width="1024"');
    expect(markup).toContain('height="768"');
    expect(markup).toContain('viewBox="0 0 40 30"');
    expect(markup).toContain('<rect/>');
  });

  it('replaces a width and height it cannot use, and keeps the other attributes', () => {
    const { markup } = sizeSvg(
      `<?xml version="1.0"?>\n<!-- a > b -->\n<svg ${ns} width='100%' fill="a>b" viewBox="0 0 4 3">x</svg>`,
    );
    expect(markup.match(/width=/g)).toHaveLength(1);
    expect(markup).toContain('width="1024"');
    expect(markup).toContain('fill="a>b"');
    expect(markup.endsWith('>x</svg>')).toBe(true);
  });

  it('gives a no-size picture a viewBox, so it is scaled and not cropped', () => {
    expect(sizeSvg(`<svg ${ns}/>`).markup).toContain('viewBox="0 0 300 150"');
  });

  it('keeps an empty root element empty', () => {
    expect(sizeSvg(`<svg ${ns} viewBox="0 0 4 3"/>`).markup).toMatch(/\/>$/);
  });

  it('refuses text that is not an SVG', () => {
    expect(() => sizeSvg('not a picture')).toThrow(Error);
    expect(() => sizeSvg('<html><body/></html>')).toThrow(Error);
    expect(() => sizeSvg('')).toThrow(Error);
  });
});
