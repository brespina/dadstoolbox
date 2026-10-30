// Copies the video's sound as it is into an M4A file: nothing is remade, so it is quick
// and needs no browser video features. Mediabunny is big, so it loads only on start.
import type { ToolRun } from '../types';
import type { tool } from './declaration';

export const run: ToolRun<typeof tool.defaultOptions> = async (file, _options, context) => {
  const loading = import('mediabunny');
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } =
    await (context?.gettingReady(loading) ?? loading);

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      video: { discard: true },
      audio: { codec: 'aac' },
      copy: { mode: 'forced' },
      showWarnings: false,
    });
    await conversion.execute();
    // Mediabunny always names MP4 as video; this one holds only sound.
    return [{ blob: new Blob([output.target.buffer!], { type: 'audio/mp4' }) }];
  } finally {
    input.dispose();
  }
};
