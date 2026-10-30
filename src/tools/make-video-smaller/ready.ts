// The Ready row's note, on the page before start: about how big the saved video will be.
import { videoFacts } from '../../video/facts';
import type { ReadyNote } from '../types';
import type { Options } from './declaration';
import { readyLines } from './estimate';

export const readyNote: ReadyNote<Options> = async (file, options) => {
  const video = await videoFacts(file);
  return video ? readyLines(video, options) : [];
};
