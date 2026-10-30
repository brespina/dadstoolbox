// The saved video's estimated file size, in plain maths, for the Ready row's note on the
// page. It imports no library, so nothing big loads before start.

import { formatSize } from '../../site/size';
import { fillText } from '../../text';
import type { VideoFacts } from '../../video/facts';
import { fitLongestSide } from '../../video/size';
import type { ReadyLine } from '../types';
import { bigVideo, sizes, tool, type Options } from './declaration';

/**
 * The picture's bits a second, as Mediabunny 1.61.4 picks them at its default quality
 * ("high") for H.264: 3 Mbps at 1080p, scaled by the picture's pixels.
 */
function pictureBitsPerSecond(width: number, height: number): number {
  const high = 0.3 * Math.exp(2.5538 * 0.75);
  const bits = 3_000_000 * Math.pow((width * height) / (1920 * 1080), 0.95) * high;
  return Math.ceil(bits / 1000) * 1000;
}

// The sound is copied as it is, and the browser's player can't say how big it is, so
// take a phone video's usual sound.
const soundBitsPerSecond = 128_000;

/** About how many bytes the saved video will be. */
export function estimateBytes(video: VideoFacts, options: Options): number {
  const { width, height } = fitLongestSide(video, sizes[options.size]).size;
  return (video.duration * (pictureBitsPerSecond(width, height) + soundBitsPerSecond)) / 8;
}

/** The Ready row's lines: the estimated size, and a warning when it's big to send. */
export function readyLines(video: VideoFacts, options: Options): ReadyLine[] {
  const bytes = estimateBytes(video, options);
  const lines: ReadyLine[] = [
    { text: fillText(tool.notes.estimate!, { size: formatSize(bytes) }) },
  ];
  if (bytes > bigVideo) {
    const tooBig = options.size === 'smallest' ? tool.notes.tooBigSmallest! : tool.notes.tooBig!;
    lines.push({ text: tooBig, warning: true });
  }
  return lines;
}
