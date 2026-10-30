// Options shared by the photo Tools. Date taken is always kept and photos are always
// saved the right way up, so only location is a choice.

import { text } from '../text';
import type { OptionsText } from '../tools/types';

export interface LocationOption {
  /** Ticked by default. Unticked, location is kept. */
  removeLocation: boolean;
}

export const locationDefault: LocationOption = { removeLocation: true };

/** "All done. Location data removed." when location was removed, else the usual words. */
export function locationText(options: LocationOption): OptionsText {
  return {
    allDone: options.removeLocation ? text.photos.allDoneLocationRemoved : text.tool.allDone,
  };
}
