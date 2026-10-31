// The type of a chosen file, such as "image/jpeg", for Tools whose options depend on it.

/** Types for the endings of files a browser sometimes hands over with no type. */
const typesByEnding: Record<string, string> = {
  heic: 'image/heic',
  heif: 'image/heif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * The type the browser gave the file, or, when it gave none (as for an iPhone photo
 * (HEIC) on some systems), the type its ending says. Empty when neither says.
 */
export function fileTypeOf(file: File): string {
  if (file.type) return file.type;
  const ending = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase();
  return (ending && typesByEnding[ending]) || '';
}
