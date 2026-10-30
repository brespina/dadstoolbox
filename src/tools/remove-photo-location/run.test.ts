import { readFileSync } from 'node:fs';
import exifr from 'exifr';
import { describe, expect, it } from 'vitest';
import { readDetails } from '../../photos/exif';
import { ToolFailure } from '../types';
import { tool } from './declaration';
import { run } from './run';

const bytes = (name: string) => new Uint8Array(readFileSync(new URL(name, import.meta.url)));
const file = (data: Uint8Array, name: string, type: string) =>
  new File([data as Uint8Array<ArrayBuffer>], name, { type });
const jpg = () => file(bytes('sample.jpg'), 'sample.jpg', 'image/jpeg');

const details = async (data: Uint8Array) =>
  (await exifr.parse(data, {
    tiff: true,
    exif: true,
    gps: true,
    reviveValues: false,
    translateValues: false,
  })) as Record<string, unknown> | undefined;

const removed = async (input: File) => {
  const [result, ...rest] = await run(input, tool.defaultOptions);
  expect(rest).toEqual([]);
  expect(result!.blob.type).toBe('image/jpeg');
  return new Uint8Array(await result!.blob.arrayBuffer());
};

describe('Remove photo location', () => {
  it('takes the location out of a JPG', async () => {
    expect(await details(bytes('sample.jpg'))).toHaveProperty('latitude');
    const out = await removed(jpg());
    const found = await details(out);
    expect(found).not.toHaveProperty('latitude');
    expect(found).not.toHaveProperty('GPSLatitude');
    expect(readDetails(out)?.location).toEqual([]);
  });
});
