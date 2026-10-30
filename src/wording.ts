// Plain-word rules for every line a visitor reads (see issue #13).
// Each rule's `word` is what a failing test reports.

const banned: { word: string; pattern: RegExp }[] = [
  // "upload" suggests files leave the device, against the Promise. Say "Choose".
  { word: 'upload', pattern: /\bupload/i },
  // Say "Save".
  { word: 'download', pattern: /\bdownload/i },
  // Use a task verb, such as "Change to JPG".
  { word: 'converter', pattern: /\bconverter/i },
  { word: 'convert', pattern: /\bconvert(?!er)/i },
  { word: 'browser engine', pattern: /\bbrowser engine/i },
  { word: 'webassembly', pattern: /\bwebassembly\b|\bwasm\b/i },
  { word: 'metadata', pattern: /\bmetadata\b/i },
  { word: 'exif', pattern: /\bexif\b/i },
  { word: 'codec', pattern: /\bcodecs?\b/i },
  { word: 'encod', pattern: /\bencod/i },
  { word: 'worker', pattern: /\bworkers?\b/i },
  { word: 'cache', pattern: /\bcache/i },
  { word: 'client-side', pattern: /\bclient[- ]side\b/i },
  { word: 'server', pattern: /\bservers?\b/i },
  { word: 'mime', pattern: /\bmime\b/i },
  { word: 'error code', pattern: /\berror codes?\b/i },
  { word: 'invalid', pattern: /\binvalid\b/i },
];

// HEIC is allowed only inside its gloss.
const heicGloss = /iPhone photos? \(HEIC\)/g;
const heic = /\bheic\b/i;

/** The banned words found in one line of visitor-facing text. */
export function bannedWordsIn(line: string): string[] {
  const found = banned.filter(({ pattern }) => pattern.test(line)).map(({ word }) => word);
  if (heic.test(line.replace(heicGloss, ''))) found.push('heic');
  return found;
}

/** Every string inside a value, however deeply nested. */
export function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}
