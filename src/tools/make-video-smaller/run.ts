// Runs in the worker (the declaration marks it so), so the page stays responsive. The
// shared video module does the work; it loads only when the first video starts.
import type { ToolRun } from '../types';
import { sizes, tool, type Options } from './declaration';

export const run: ToolRun<Options> = async (file, options, context) => {
  const loading = import('../../video/remake');
  const { remakeVideo } = await (context?.gettingReady(loading) ?? loading);
  const longestSide = sizes[options.size];
  return [{ blob: await remakeVideo(file, { reasons: tool.reasons, longestSide }) }];
};
