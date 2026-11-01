import { formatTypes, type Format } from './declaration';

const allFormats = Object.keys(formatTypes) as Format[];

/**
 * The types to offer, in order. A type is left out when every chosen image already is
 * that type, so no choice does nothing. A mix, or nothing chosen, offers every type.
 * WebP is offered only where the browser can save it.
 */
export function offeredFormats(chosenTypes: readonly string[], canSaveWebp: boolean): Format[] {
  return allFormats.filter(
    (format) =>
      (format !== 'webp' || canSaveWebp) &&
      !(chosenTypes.length > 0 && chosenTypes.every((type) => type === formatTypes[format])),
  );
}
