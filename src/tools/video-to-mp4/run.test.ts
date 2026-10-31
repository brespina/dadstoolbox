// What `run` can cover in Node: the plain reasons. Making the MP4 needs a browser's
// video features, so the page tests check the saved file.
// cantKeepSound needs a browser that makes the picture but not the sound, which Node is
// not: the shared video module's page tests in tests/e2e/video-to-mp4.spec.ts cover it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { tool } from './declaration';
import { run } from './run';

const reasonFor = async (file: File) => {
  const failure = await run(file, {}).catch((e: unknown) => e);
  expect(failure).toBeInstanceOf(ToolFailure);
  return (failure as ToolFailure).reason;
};

describe('Make a video play anywhere (MP4)', () => {
  it('says plainly when the browser cannot make the video', async () => {
    // Node has no video features, as on a browser that can't make this video.
    const sample = new File([readFileSync(new URL('sample.mov', import.meta.url))], 'sample.mov');
    expect(await reasonFor(sample)).toBe(tool.reasons.cantMake);
  });

  it('says plainly when the file is not a video', async () => {
    const notVideo = new File(['just some words'], 'notes.mp4', { type: 'video/mp4' });
    expect(await reasonFor(notVideo)).toBe(tool.reasons.notVideo);
  });
});
