/**
 * Whether this browser can save WebP. A browser that can't quietly saves a PNG
 * instead, so a tiny picture is saved and its type checked.
 */
export function canSaveWebp(): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob?.type === 'image/webp'), 'image/webp'),
  );
}
