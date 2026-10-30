// Copies the video's sound as it is into an M4A file: nothing is remade, so it is quick
// and needs no browser video features. Mediabunny is big, so it loads only on start.
import { ToolFailure, type ToolRun } from '../types';
import { tool } from './declaration';

export const run: ToolRun<typeof tool.defaultOptions> = async (file, _options, context) => {
  const loading = import('mediabunny');
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } =
    await (context?.gettingReady(loading) ?? loading);

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    if (!(await input.getPrimaryAudioTrack())) throw new ToolFailure(tool.reasons.noSound!);

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
    // The sound would have to be remade, such as Opus sound, which iPhones don't play
    // from an M4A file. The sound is never remade here.
    if (!conversion.isValid) throw new ToolFailure(tool.reasons.cantCopy!);
    await conversion.execute();
    // Mediabunny always names MP4 as video; this one holds only sound.
    return [{ blob: new Blob([output.target.buffer!], { type: 'audio/mp4' }) }];
  } finally {
    input.dispose();
  }
};
