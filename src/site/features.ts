// Browser features a Tool may need (its declaration's `needs`), checked when the page
// runs. Where one is missing, the Tool says "Doesn't work on this browser yet".

import type { BrowserFeature } from '../tools/types';

const checks: Record<BrowserFeature, () => boolean> = {
  // Reading video frames, drawn off the page in a worker (Safari 16.4, Chrome 94,
  // Firefox 130; not Firefox for Android).
  webcodecs: () => 'VideoDecoder' in globalThis && 'OffscreenCanvas' in globalThis,
};

/** Whether this browser has every feature in `needs`. */
export function browserCanRun(needs: readonly BrowserFeature[]): boolean {
  return needs.every((feature) => checks[feature]());
}
