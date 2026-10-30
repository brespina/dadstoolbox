// What `run` can cover in Node: the gif's size and frames (from stand-in frames), the
// plain reasons, and the size estimate. Reading real frames needs a browser's video
// features, so the page tests cover that.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { tool, type Options } from './declaration';
import { readyLines } from './gif';
import { makeRun, run, type Video } from './run';

const normal: Options = { size: 'normal' };

/** A stand-in video of one flat colour, with every frame asked for. */
function fakeVideo(width: number, height: number, duration: number) {
  const asked: { width: number; height: number; times: number[] } = {
    width: 0,
    height: 0,
    times: [],
  };
  const video: Video = {
    width,
    height,
    duration,
    async *frames(w, h, times) {
      Object.assign(asked, { width: w, height: h, times: [...times] });
      for (const _ of times) yield new Uint8ClampedArray(w * h * 4).fill(200);
    },
  };
  return { asked, run: makeRun(async () => async () => video) };
}

const file = (name = 'clip.mp4') => new File([new Uint8Array(10)], name, { type: 'video/mp4' });

/** A gif's width, height and number of frames, read from its bytes. */
function readGif(bytes: Uint8Array) {
  expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe('GIF89a');
  const width = bytes[6]! | (bytes[7]! << 8);
  const height = bytes[8]! | (bytes[9]! << 8);
  const colourTable = (flags: number) => (flags & 0x80 ? 3 * 2 ** ((flags & 7) + 1) : 0);
  let at = 13 + colourTable(bytes[10]!);
  const skipBlocks = () => {
    while (bytes[at]! !== 0) at += bytes[at]! + 1;
    at++;
  };
  let frames = 0;
  while (bytes[at] !== 0x3b) {
    if (bytes[at] === 0x21) {
      at += 2;
      skipBlocks();
    } else if (bytes[at] === 0x2c) {
      frames++;
      at += 10 + colourTable(bytes[at + 9]!) + 1;
      skipBlocks();
    } else throw new Error(`Unexpected gif block ${bytes[at]} at ${at}`);
  }
  return { width, height, frames };
}

const gifOf = async (results: { blob: Blob }[]) => {
  expect(results).toHaveLength(1);
  expect(results[0]!.blob.type).toBe('image/gif');
  return readGif(new Uint8Array(await results[0]!.blob.arrayBuffer()));
};

describe('Make a gif from a video', () => {
  it('makes a gif with its longest side 480 px, 10 frames a second', async () => {
    const { run, asked } = fakeVideo(1280, 720, 2);
    expect(await gifOf(await run(file(), normal))).toEqual({ width: 480, height: 270, frames: 20 });
    expect(asked.times.slice(0, 3)).toEqual([0, 0.1, 0.2]);
  });

  it('keeps a tall video tall', async () => {
    const { run } = fakeVideo(1080, 1920, 1);
    expect(await gifOf(await run(file(), normal))).toEqual({ width: 270, height: 480, frames: 10 });
  });

  it('makes the longest side 320 px when Small is chosen', async () => {
    const { run } = fakeVideo(1920, 1080, 0.5);
    expect(await gifOf(await run(file(), { size: 'small' }))).toEqual({
      width: 320,
      height: 180,
      frames: 5,
    });
  });

  it('never makes a small video bigger', async () => {
    const { run } = fakeVideo(200, 100, 0.3);
    expect(await gifOf(await run(file(), normal))).toEqual({ width: 200, height: 100, frames: 3 });
  });

  it('makes one frame from a very short video', async () => {
    const { run } = fakeVideo(640, 360, 0.04);
    expect((await gifOf(await run(file(), normal))).frames).toBe(1);
  });

  it('says plainly when the browser cannot open the video', async () => {
    // Node has no video features, as on a browser without them for this video.
    const sample = new File([readFileSync(new URL('sample.mp4', import.meta.url))], 'sample.mp4');
    const failure = await run(sample, normal).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(tool.reasons.cantOpen);
  });

  it('says plainly when the file is not a video', async () => {
    const notVideo = new File(['just some words'], 'notes.mp4', { type: 'video/mp4' });
    const failure = await run(notVideo, normal).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(tool.reasons.notVideo);
  });
});

describe('the size estimate on the Ready row', () => {
  it('allows about 0.36 bytes a pixel a frame, as a real iPhone clip made (#10)', () => {
    // 94 frames of 270 × 480.
    const [estimate] = readyLines({ width: 1080, height: 1920, duration: 9.4 }, normal);
    expect(estimate).toEqual({ text: 'The gif will be about 4.4 MB.' });
  });

  it('warns about a gif over about 15 MB, suggesting a shorter clip or Small', () => {
    expect(readyLines({ width: 1920, height: 1080, duration: 60 }, normal)).toEqual([
      { text: 'The gif will be about 28 MB.' },
      { text: "That's big to send. Try a shorter clip, or choose Small.", warning: true },
    ]);
  });

  it('gets smaller with Small', () => {
    expect(readyLines({ width: 1920, height: 1080, duration: 60 }, { size: 'small' })).toEqual([
      { text: 'The gif will be about 12 MB.' },
    ]);
  });
});
