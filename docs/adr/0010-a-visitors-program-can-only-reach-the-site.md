# A visitor's program runs in a blob worker, so it can only reach the Site

Run Python runs Python that a visitor wrote, or pasted from someone else. Pyodide's `js` module gives Python everything JavaScript in its worker can do, including `fetch()` to other websites. A worker loaded from a normal address is not bound by the page's `<meta>` Content-Security-Policy, so ADR-0003's browser lock would not have stopped it (tested in the research: a `no-cors` fetch to another site succeeded). A worker made from a `blob:` URL inherits the page's lock (the same `fetch` failed, from JavaScript and from Python). So the Python worker is always a blob worker. The browser keeps the Promise here, not the Tool's good behaviour.

## What a Program can reach

- **Only the Site.** `connect-src 'self'` lets it fetch any page or file of the Site, and of anything else on the same origin (`bwandii.io`), which is shared with the owner's other GitHub Pages projects. It can't send anything to another site, but it can read same-origin pages and files, and **IndexedDB and Cache API data** (workers have them), so nothing secret may live in those on that origin. It cannot read `localStorage` or cookies (a worker has neither), which is why ADR-0011 chooses `localStorage`.
- **The visitor's processor and memory.** It can use a core for ever or fill memory until the tab dies. Pyodide 314.0.8 has no memory limit. Stop and a visible "Running…" are the controls; a program that runs out of room is reported plainly and Python starts again.
- **The page, through messages only.** A worker cannot touch the page. The page accepts only the message types it defines (checked by a validator) and shows output as text, never as HTML.

## What it can't reach

- The visitor's files and folders: Pyodide's file system is in memory and goes with the page. Only the page itself can open a file picker, and it does so only when the visitor presses Choose.
- The page's variables, cookies and `localStorage`, other tabs, or the operating system. Sockets, threads and processes don't work.

## Consequences

- Any later Tool that runs a visitor's own program must use a blob worker too, and the guide says so.
- The credits page names the libraries. The Tool's page tells visitors only what they need: what a program prints, and that it can't use the internet.
- The Site's owner should check what else is served from `bwandii.io` before this ships (other projects' data in IndexedDB or the Cache API, and their pages, are reachable by a Program).
- Unverified until built: that blob workers inherit the lock on iPhone Safari. The real-phone ticket checks it.

Planned in spec #123 (Run Python). Research: `docs/research/python-in-the-browser.md`, section 7.
