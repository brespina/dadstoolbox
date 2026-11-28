# The Site keeps no data about visitors

The Site makes the Promise: no sign-up, no ads, no trackers or visitor counters, and a person's files are never kept or sent anywhere. We chose this over cookieless page-view counting (GoatCounter, Cloudflare Web Analytics), which would have shown which Tools people use, because once the Promise is stated publicly, quietly adding a counter later would break trust. Usage is judged instead from GitHub stars and follows, and from feedback people choose to send.

## Consequences

- Outside requests are allowed only when they carry nothing about the visitor or their files. Files are served from the Site itself by default; a CDN is used only when a file is too big to host there, and then with Subresource Integrity. Tools that fetch live data (such as currency rates) are fine.
- Every page carries a Content-Security-Policy `<meta>` tag limiting where it may send requests to the Site itself plus any outside addresses a Tool declares, so the browser enforces the Promise rather than the Site merely claiming it.
- The Promise covers what the Site itself does. The host (GitHub Pages) may keep its own basic visit records for security; the Site can't see or use them, and the Our promise page says so in one plain sentence rather than hiding it.

## Note, 2026-11-27

The decision stands, with one choice added: a person may Keep their Program in their own browser on Run Python, never sent anywhere (ADR-0011). Under the default, nothing is kept.
