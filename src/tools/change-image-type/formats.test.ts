import { describe, expect, it } from 'vitest';
import { offeredFormats } from './formats';

describe('the types Change image file type offers', () => {
  it('offers every type before anything is chosen', () => {
    expect(offeredFormats([], true)).toEqual(['jpg', 'png', 'webp', 'ico']);
  });

  it('leaves out the type every chosen image already is', () => {
    expect(offeredFormats(['image/jpeg', 'image/jpeg'], true)).toEqual(['png', 'webp', 'ico']);
    expect(offeredFormats(['image/png'], true)).toEqual(['jpg', 'webp', 'ico']);
    expect(offeredFormats(['image/webp'], true)).toEqual(['jpg', 'png', 'ico']);
  });

  it('offers every type for a mix', () => {
    expect(offeredFormats(['image/jpeg', 'image/png'], true)).toEqual([
      'jpg',
      'png',
      'webp',
      'ico',
    ]);
  });

  it('offers every type when one chosen image is of another kind, such as an iPhone photo (HEIC)', () => {
    expect(offeredFormats(['image/jpeg', 'image/heic'], true)).toEqual([
      'jpg',
      'png',
      'webp',
      'ico',
    ]);
    expect(offeredFormats(['image/heic'], true)).toEqual(['jpg', 'png', 'webp', 'ico']);
  });

  it('leaves out ICO only when every chosen image is already an ICO', () => {
    expect(offeredFormats(['image/x-icon'], true)).toEqual(['jpg', 'png', 'webp']);
    expect(offeredFormats(['image/x-icon', 'image/png'], true)).toEqual([
      'jpg',
      'png',
      'webp',
      'ico',
    ]);
  });

  it('leaves out WebP where the browser cannot save it', () => {
    expect(offeredFormats([], false)).toEqual(['jpg', 'png', 'ico']);
    expect(offeredFormats(['image/jpeg'], false)).toEqual(['png', 'ico']);
  });
});
