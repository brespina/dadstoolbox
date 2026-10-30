// Runs in the worker (the declaration marks it so), so the page stays responsive.
// Mediabunny reads the video's frames through the browser's own video features, and
// gifenc builds the gif. Both are big, so they load only when the first video starts.
import { ToolFailure, type ToolRun } from '../types';
import { framesPerSecond, tool, type Options } from './declaration';
import { frameTimes, gifSize } from './gif';

/** An opened video: its shown size and seconds, and its frames as RGBA pixels. */
export interface Video {
  width: number;
  height: number;
  duration: number;
  frames(width: number, height: number, times: number[]): AsyncIterable<Uint8ClampedArray>;
}

/** Opens a video, or throws a ToolFailure saying plainly why it can't. */
export type OpenVideo = (file: File) => Promise<Video>;

/** The Tool's job, with the video reading passed in so tests can stand in for it. */
export function makeRun(loadOpener: () => Promise<OpenVideo>): ToolRun<Options> {
  return async (file, options, context) => {
    const loading = Promise.all([loadOpener(), import('gifenc')]);
    const [open, { GIFEncoder, quantize, applyPalette }] = await (context?.gettingReady(loading) ??
      loading);

    const video = await open(file);
    const { width, height } = gifSize(video, options);
    const gif = GIFEncoder();
    let frames = 0;
    for await (const rgba of video.frames(width, height, frameTimes(video.duration))) {
      // Each frame gets its own colours: slower than sharing them, but truer.
      const palette = quantize(rgba, 256);
      gif.writeFrame(applyPalette(rgba, palette), width, height, {
        palette,
        delay: 1000 / framesPerSecond,
      });
      frames++;
    }
    if (frames === 0) throw new ToolFailure(tool.reasons.cantOpen!);
    gif.finish();
    return [{ blob: new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: 'image/gif' }) }];
  };
}

/** Opens a video with Mediabunny, drawing frames on a canvas off the page. */
async function loadMediabunny(): Promise<OpenVideo> {
  const { ALL_FORMATS, BlobSource, CanvasSink, Input } = await import('mediabunny');
  return async (file) => {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    // An unknown kind of file throws here.
    const track = await input.getPrimaryVideoTrack().catch(() => null);
    if (!track) {
      input.dispose();
      throw new ToolFailure(tool.reasons.notVideo!);
    }
    // Such as an iPhone HEVC video on a browser that can't read it.
    if (!(await track.canDecode().catch(() => false))) {
      input.dispose();
      throw new ToolFailure(tool.reasons.cantOpen!);
    }
    return {
      // Shown sizes are already turned the right way up, as the frames will be.
      width: await track.getDisplayWidth(),
      height: await track.getDisplayHeight(),
      duration: await track.computeDuration(),
      async *frames(width, height, times) {
        // One canvas at a time, so a phone's memory doesn't climb.
        const sink = new CanvasSink(track, { width, height, fit: 'fill', poolSize: 1 });
        try {
          for await (const frame of sink.canvasesAtTimestamps(times)) {
            if (!frame) continue;
            const canvas = frame.canvas as OffscreenCanvas;
            const context = canvas.getContext('2d', { willReadFrequently: true })!;
            yield context.getImageData(0, 0, width, height).data;
          }
        } finally {
          input.dispose();
        }
      },
    };
  };
}

export const run = makeRun(loadMediabunny);
