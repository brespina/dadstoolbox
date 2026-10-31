// The plain reasons the shared video module (remake.ts) fails with. Plain data, so a
// video Tool's declaration can spread them into its `reasons`: the banned-words scan
// then reads them, and `run` passes `tool.reasons` back to the module.

export const videoReasons = {
  notVideo: "This file doesn't look like a video. Choose a video from your phone or computer.",
  cantMake: "This browser can't make this video. Try another browser.",
  cantKeepSound: "This browser can't keep this video's sound. Try another browser.",
} as const;

export type VideoReasonKey = keyof typeof videoReasons;
