// Runs in the worker (the declaration marks it so), so the page stays responsive. The
// shared video module cuts and remakes the video; it loads only when the first video
// starts. Start and End come from the video's own Ready row (`fileOptions`).
import { ToolFailure, type ToolRun } from '../types';
import { tool, type Options } from './declaration';

export const run: ToolRun<Options> = async (file, options, context) => {
  // The page holds start back first; this is for any other caller.
  if (tool.optionsProblem(options)) throw new ToolFailure(tool.reasons.endBeforeStart!);
  const loading = import('../../video/remake');
  const { remakeVideo } = await (context?.gettingReady(loading) ?? loading);
  const range = { start: options.start, ...(options.end !== null && { end: options.end }) };
  return [
    {
      blob: await remakeVideo(file, {
        reasons: tool.reasons,
        range,
        onProgress: (fraction) => context?.progress(fraction),
      }),
    },
  ];
};
