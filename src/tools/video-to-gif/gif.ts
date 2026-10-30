// The gif's size, frames and estimated file size, in plain maths. Shared by `run` (in
// the worker) and the Ready row's note (on the page), so it imports no library.

import { formatSize } from '../../site/size';
import { fillText } from '../../text';
import type { ReadyLine } from '../types';
import { bigGif, framesPerSecond, sizes, tool, type Options } from './declaration';

/** A video's shown width and height (already turned the right way up), and its seconds. */
export interface VideoFacts {
  width: number;
  height: number;
  duration: number;
}

/** The gif's width and height: the longest side made the chosen size, never bigger. */
export function gifSize({ width, height }: Pick<VideoFacts, 'width' | 'height'>, options: Options) {
  const scale = Math.min(1, sizes[options.size] / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** When each frame is taken from the video, in seconds: 10 a second, at least one. */
export function frameTimes(duration: number): number[] {
  const count = Math.max(1, Math.floor(duration * framesPerSecond));
  return Array.from({ length: count }, (_, i) => i / framesPerSecond);
}

// Bytes a pixel a frame, from a real iPhone camera clip (#10: 94 frames of 480 × 853 made
// 13.8 MB). Calm or flat videos come out smaller; busy camera video is the worst case.
const bytesPerPixel = 0.36;

/** At most about how many bytes the gif will be: busy camera video, the worst case. */
export function estimateBytes(video: VideoFacts, options: Options): number {
  const { width, height } = gifSize(video, options);
  return frameTimes(video.duration).length * width * height * bytesPerPixel;
}

/** The Ready row's lines: the estimated size, and a warning when it's big to send. */
export function readyLines(video: VideoFacts, options: Options): ReadyLine[] {
  const bytes = estimateBytes(video, options);
  const lines: ReadyLine[] = [
    { text: fillText(tool.notes.estimate!, { size: formatSize(bytes) }) },
  ];
  if (bytes > bigGif) lines.push({ text: tool.notes.tooBig!, warning: true });
  return lines;
}
