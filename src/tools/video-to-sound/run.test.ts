// Copying the sound needs no browser video features, so `run` is tested here with real videos.
import { readFileSync } from 'node:fs';
import { ALL_FORMATS, BufferSource, Input } from 'mediabunny';
import { describe, expect, it } from 'vitest';
import { run } from './run';

const video = (path: string) =>
  new File([readFileSync(new URL(path, import.meta.url))], path.split('/').pop()!, {
    type: 'video/mp4',
  });

describe('Get the sound from a video', () => {
  it("saves the sample video's 2 seconds of sound as an M4A, with no picture", async () => {
    const results = await run(video('sample.mp4'), {});
    expect(results).toHaveLength(1);
    expect(results[0]!.blob.type).toBe('audio/mp4');

    const m4a = new Input({
      source: new BufferSource(await results[0]!.blob.arrayBuffer()),
      formats: ALL_FORMATS,
    });
    const tracks = await m4a.getTracks();
    expect(tracks.map((t) => t.type)).toEqual(['audio']);
    expect(tracks[0]!.codec).toBe('aac');
    expect(await m4a.computeDuration()).toBeCloseTo(2, 1);
  });
});
