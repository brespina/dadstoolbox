// The Ready row's note, on the page before start: about how big the gif will be.
import { videoFacts } from '../../video/facts';
import type { ReadyNote } from '../types';
import type { Options } from './declaration';
import { readyLines } from './gif';

export const readyNote: ReadyNote<Options> = async (file, options) => {
  const video = await videoFacts(file);
  return video ? readyLines(video, options) : [];
};
