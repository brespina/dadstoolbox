// The shared video module: remakes a video as an H.264 MP4 with AAC sound, with
// Mediabunny and the browser's own video features. Every video Tool that remakes a
// video calls `remakeVideo` from its `run`, in the worker.
//
// It grows one setting at a time (spec #41): Make a video smaller adds a longest side,
// Trim a video adds a time range, and the progress hook arrives with #48. Each one is a
// new field of RemakeSettings.
//
// Mediabunny is big, so a Tool imports this module with a dynamic import() inside its
// `run`, under context.gettingReady.

import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeVideo,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from 'mediabunny';
import { ToolFailure, type Reason } from '../tools/types';
import type { VideoReasonKey } from './reasons';

export interface RemakeSettings {
  /** The calling Tool's own copies of the shared video reasons (`tool.reasons`). */
  reasons: Readonly<Record<VideoReasonKey, Reason>>;
}

/**
 * Remakes a video as an H.264 MP4 with AAC sound, the picture size kept. Sound already in
 * AAC is copied as is. It never drops the picture or the sound: when the browser can't
 * make either, it throws a ToolFailure with a plain reason instead.
 */
export async function remakeVideo(file: Blob, { reasons }: RemakeSettings): Promise<Blob> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    // An unknown kind of file throws here.
    const track = await input.getPrimaryVideoTrack().catch(() => null);
    if (!track) throw new ToolFailure(reasons.notVideo);

    // Ask first whether this browser can read this video and make one this size.
    const width = await track.getDisplayWidth();
    const height = await track.getDisplayHeight();
    const canMake =
      (await track.canDecode().catch(() => false)) &&
      (await canEncodeVideo('avc', { width, height }).catch(() => false));
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
      },
      audio: { codec: 'aac' },
      showWarnings: false,
    });
    // Mediabunny still makes a file when it drops a track, so never trust that alone.
    const dropped = conversion.discardedTracks.map(({ track }) => track.type);
    if (!conversion.isValid || dropped.includes('video')) throw new ToolFailure(reasons.cantMake);
    // Such as Opus sound on a browser that can't make AAC: never save a silent video.
    if (dropped.includes('audio')) throw new ToolFailure(reasons.cantKeepSound);

    await conversion.execute();
    return new Blob([output.target.buffer!], { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}
