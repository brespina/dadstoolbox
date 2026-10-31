import { describe, expect, it } from 'vitest';
import { fileTypeOf } from './file-type';

describe('the type of a chosen file', () => {
  it('is the one the browser gave the file', () => {
    expect(fileTypeOf(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe('image/jpeg');
  });

  it('comes from the ending when the browser gave none, as for an iPhone photo (HEIC)', () => {
    expect(fileTypeOf(new File([], 'IMG_1234.HEIC'))).toBe('image/heic');
    expect(fileTypeOf(new File([], 'scan.jpeg'))).toBe('image/jpeg');
    expect(fileTypeOf(new File([], 'logo.PNG'))).toBe('image/png');
  });

  it('is empty when nothing says what the file is', () => {
    expect(fileTypeOf(new File([], 'notes'))).toBe('');
    expect(fileTypeOf(new File([], 'notes.xyz'))).toBe('');
  });
});
