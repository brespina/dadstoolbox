// A chosen video's shown size and length, read on the page for a Ready row's note. The
// browser's own video player reads them, so no big library loads before start.

/** A video's shown width and height (already turned the right way up), and its seconds. */
export interface VideoFacts {
  width: number;
  height: number;
  duration: number;
}

// Read once per chosen file, so changing the options doesn't read it again.
const read = new WeakMap<File, Promise<VideoFacts | undefined>>();

/** The video's facts, or nothing when this browser's player can't read it. */
export function videoFacts(file: File): Promise<VideoFacts | undefined> {
  let found = read.get(file);
  if (!found) read.set(file, (found = readFacts(file)));
  return found;
}

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
