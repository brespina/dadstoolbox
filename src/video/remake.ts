// The shared video module: remakes a video as an H.264 MP4 with AAC sound, with
// Mediabunny and the browser's own video features. Every video Tool that remakes a
// video calls `remakeVideo` from its `run`, in the worker.
//
// It grows one setting at a time (spec #41): Make a video smaller adds a longest side,
// Trim a video adds a time range, and every caller passes the progress hook. Each one is
// a new field of RemakeSettings.
//
// Mediabunny is big, so a Tool imports this module with a dynamic import() inside its
// `run`, under context.gettingReady.

import {
  ALL_FORMATS,
  AudioSampleSink,
  BlobSource,
  BufferTarget,
  canEncodeVideo,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  type InputAudioTrack,
} from 'mediabunny';
import { ToolFailure, type Reason } from '../tools/types';
import type { VideoReasonKey } from './reasons';
import { fitLongestSide } from './size';

export interface RemakeSettings {
  /** The calling Tool's own copies of the shared video reasons (`tool.reasons`). */
  reasons: Readonly<Record<VideoReasonKey, Reason>>;
  /** At most this many pixels on the picture's longest side; never made larger. */
  longestSide?: number;
  /**
   * The part to keep, in seconds from the start of the video. End left out means to the
   * end. The cut is exact, as the picture is always remade. The caller makes sure start
   * comes before end.
   */
  range?: { start: number; end?: number };
  /** Called as the video is made, with how far along it is from 0 to 1 (`context.progress`). */
  onProgress?: (fraction: number) => void;
}

/**
 * Remakes a video as an H.264 MP4 with AAC sound, the picture size kept unless a
 * longest side is given. Sound already in AAC is copied as is; other sound is remade.
 * It never drops the picture or the sound: when the browser can't make either, it
 * throws a ToolFailure with a plain reason instead.
 */
export async function remakeVideo(
  file: Blob,
  { reasons, longestSide, range, onProgress }: RemakeSettings,
): Promise<Blob> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    // An unknown kind of file throws here.
    const track = await input.getPrimaryVideoTrack().catch(() => null);
    if (!track) throw new ToolFailure(reasons.notVideo);

    // Ask first whether this browser can read this video and make one this size.
    const fit = fitLongestSide(
      { width: await track.getDisplayWidth(), height: await track.getDisplayHeight() },
      longestSide,
    );
    const canMake =
      (await track.canDecode().catch(() => false)) &&
      (await canEncodeVideo('avc', fit.size).catch(() => false));
    if (!canMake) throw new ToolFailure(reasons.cantMake);

    const output = new Output({
      // The index goes first, so older players can start without reading to the end.
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        codec: 'avc',
        // Always remade, even from an H.264 .mp4: one that won't play may be fixed by it.
        forceTranscode: true,
        // Turned the right way up in the picture itself: old TVs may ignore a "turn" note.
        allowTransformationMetadata: false,
        ...fit.set,
      },
      audio: { codec: 'aac' },
      ...(range && { trim: range }),
      showWarnings: false,
    });
    // Mediabunny still makes a file when it drops a track, so never trust that alone.
    const dropped = conversion.discardedTracks.map(({ track }) => track.type);
    if (!conversion.isValid || dropped.includes('video')) throw new ToolFailure(reasons.cantMake);
    // Such as Opus sound on a browser that can't make AAC: never save a silent video.
    if (dropped.includes('audio')) throw new ToolFailure(reasons.cantKeepSound);
    // Sound that isn't AAC is remade, so the browser must read it. WebKit on Linux says it
    // reads Opus but never gives back any sound, which would leave the row on Working…
    for (const track of conversion.utilizedTracks) {
      if (!track.isAudioTrack() || (await track.getCodec()) === 'aac') continue;
      if (!(await readsSound(track, range?.start ?? 0))) {
        throw new ToolFailure(reasons.cantKeepSound);
      }
    }

    if (onProgress) conversion.onProgress = (fraction) => onProgress(fraction);
    await conversion.execute();
    return new Blob([output.target.buffer!], { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}

/** How long to wait for the first bit of sound before deciding the browser can't read it. */
const soundWait = 10_000;

/** Whether the browser gives back the first bit of this sound in good time. */
async function readsSound(track: InputAudioTrack, from: number): Promise<boolean> {
  const samples = new AudioSampleSink(track).samples(from);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<'late'>(
    (resolve) => (timer = setTimeout(() => resolve('late'), soundWait)),
  );
  try {
    const first = await Promise.race([samples.next(), late]);
    if (first === 'late') return false;
    first.value?.close();
    // Not awaited: a stuck reader never finishes, and the caller disposes of the input.
    void samples.return().catch(() => {});
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
