/** A file size the way people read it, such as "3.8 MB" or "120 KB". */
export function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} bytes`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 999.5 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const shown = value < 9.95 ? value.toFixed(1) : String(Math.round(value));
  return `${shown} ${units[unit]}`;
}
