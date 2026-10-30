// The browser lock (ADR-0003). Astro adds script-src and style-src hashes itself;
// these directives keep every other kind of request on the Site.

/**
 * CSP directives for every page. `outsideAddresses` are the outside origins Tools
 * declare (for example a live-data source); nothing else may be contacted.
 * blob: and data: stay on the visitor's device, so they are allowed.
 */
export function cspDirectives(outsideAddresses: readonly string[]) {
  const connect = ["'self'", 'blob:', 'data:', ...new Set(outsideAddresses)].join(' ');
  const directives = [
    "default-src 'self'",
    `connect-src ${connect}`,
    "img-src 'self' blob: data:",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ] as const;
  return [...directives];
}
