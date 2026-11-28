// Run Python's service worker (ADR-0009), the technique of coi-serviceworker, our own
// code. Served from /dadstoolbox/run-python/, so its scope is that folder and nothing
// else. It adds the two headers that make the page cross-origin isolated, so
// SharedArrayBuffer exists there.
//
// To retire it (if the Tool is ever removed), keep this file and replace its body with:
//   self.addEventListener('install', () => self.skipWaiting());
//   self.addEventListener('activate', (event) => event.waitUntil(
//     self.registration.unregister()
//       .then(() => self.clients.matchAll())
//       .then((clients) => clients.forEach((client) => client.navigate(client.url)))));
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // A Chrome quirk: this combination throws if fetched, so let the browser handle it.
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  event.respondWith(
    fetch(request).then((response) => {
      if (response.status === 0) return response;
      const headers = new Headers(response.headers);
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Resource-Policy', 'same-origin');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }),
  );
});
