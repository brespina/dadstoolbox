// The Ready row's note, on the page before start: about how big the gif will be. The
// browser's own video player reads the size and length, so no big library loads yet.
import type { ReadyNote } from '../types';
import type { Options } from './declaration';
import { readyLines, type VideoFacts } from './gif';

// Read once per chosen file, so changing the options doesn't read it again.
const facts = new WeakMap<File, Promise<VideoFacts | undefined>>();

function readFacts(file: File): Promise<VideoFacts | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    // Some browsers never say, so stop waiting after a while: no estimate then.
    const giveUp = setTimeout(() => done(), 5000);
    const done = (found?: VideoFacts) => {
      clearTimeout(giveUp);
      video.onloadedmetadata = video.onerror = null;
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve(found);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () =>
      done(
        video.videoWidth > 0 && Number.isFinite(video.duration)
          ? { width: video.videoWidth, height: video.videoHeight, duration: video.duration }
          : undefined,
      );
    // A video this browser can't play gets no estimate; start says why.
    video.onerror = () => done();
    video.src = url;
    video.load();
  });
}

export const readyNote: ReadyNote<Options> = async (file, options) => {
  let found = facts.get(file);
  if (!found) facts.set(file, (found = readFacts(file)));
  const video = await found;
  return video ? readyLines(video, options) : [];
};
