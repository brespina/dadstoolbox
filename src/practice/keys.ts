// Which key presses a Practice Tool takes, shared by every practice page so they agree.

/**
 * A shortcut such as Ctrl+R or Cmd+R, which stays the browser's. Two ways of typing a
 * character count as typing, not shortcuts:
 * - AltGr, which a browser reports as Ctrl+Alt on Windows, types characters such as {
 *   on many keyboards.
 * - Option (Alt) on its own types characters such as { on a Mac's German keyboard. Alt
 *   with a plain letter or digit (Alt+D on Windows) is still a shortcut.
 */
export function isShortcut(event: KeyboardEvent): boolean {
  if (event.metaKey) return true;
  if (event.ctrlKey) return !event.altKey;
  if (event.altKey) return /^[a-z0-9]$/i.test(event.key);
  return false;
}

/**
 * Whether a key pressed while the practice area isn't focused should start practice
 * there: "Click or press any key to start". A printable key does, unless it is a
 * shortcut, a Space (which presses a focused button or setting), or typed into a box
 * on the page.
 */
export function startsPractice(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.key.length !== 1 || event.key === ' ') return false;
  if (isShortcut(event)) return false;
  const active = document.activeElement;
  const typingElsewhere =
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    (active instanceof HTMLInputElement && !['radio', 'checkbox'].includes(active.type)) ||
    (active instanceof HTMLElement && active.isContentEditable);
  return !typingElsewhere;
}

/**
 * Calls `set` with whether the device is touch only (no mouse or trackpad, matched by
 * `(any-pointer: fine)`), now and whenever that changes, such as when a mouse is plugged
 * in. The browser can't be asked about a keyboard; a mouse is the nearest sign of one.
 * Returns a function that stops listening.
 */
export function watchTouchOnly(set: (touchOnly: boolean) => void): () => void {
  const fine = matchMedia('(any-pointer: fine)');
  const update = () => set(!fine.matches);
  update();
  fine.addEventListener('change', update);
  return () => fine.removeEventListener('change', update);
}
