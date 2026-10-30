// Saving results to the visitor's device. Nothing leaves the device: the share sheet
// and a normal save both hand the file straight to the phone or computer.

export interface SavableFile {
  name: string;
  blob: Blob;
}

/**
 * Opens the share sheet with the files where the browser can share files (so an iPhone
 * can "Save to Photos"), and saves them normally otherwise. A cancelled share does nothing.
 */
export async function saveFiles(files: readonly SavableFile[]) {
  const asFiles = files.map(({ name, blob }) => new File([blob], name, { type: blob.type }));
  if (navigator.canShare?.({ files: asFiles })) {
    try {
      await navigator.share({ files: asFiles });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Sharing was refused for another reason; save normally instead.
      console.error('Share sheet failed, saving normally', error);
    }
  }
  for (const file of asFiles) saveWithLink(file);
}

function saveWithLink(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  // Give the browser time to start the save before letting the file go.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
