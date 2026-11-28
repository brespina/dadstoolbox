# Python runs in the browser with Pyodide

Run Python runs a visitor's Program with Pyodide (real CPython compiled to WebAssembly, pinned to an exact version, MPL-2.0), served from the Site and loaded only when the Tool's page is opened. We chose it over MicroPython, which is 25 times smaller (about 0.5 MB, not about 6 MB) but is a subset of Python 3.4 without `itertools`, `functools`, `datetime`, `dataclasses` and `statistics`, so ordinary homework programs would fail in ways a tutorial never shows. We chose it over a server for the reasons in ADR-0001. The first pin is Pyodide 314.0.8 (Python 3.14); a later version is a deliberate change, because the credits test pins it.

## Consequences

- Five files are served, from the `pyodide` npm package by a build integration (as `src/site/pdfjs-files.ts` serves pdf.js data), under a versioned folder of the Tool's own path: `pyodide.asm.wasm`, `pyodide.asm.mjs`, `python_stdlib.zip`, `pyodide-lock.json` and `pyodide.mjs`. About 6 MB goes over the wire on a first visit. They are not committed. They are never modified, so MPL-2.0's file-level terms are met by shipping them as they are and crediting them (with CPython, PSF-2.0).
- Only Python's own library works. No package is loaded: no micropip, no PyPI, no network from a Program. A missing module gets a plain reason.
- The browser lock gains `'wasm-unsafe-eval'` in `script-src` **on this Tool's page only**, through Astro's per-page CSP. It allows WebAssembly to be compiled and nothing else (no `eval` of text). ADR-0006 refused it because widening every page for one Tool's renderer was not worth it; that reasoning still holds, so no other page gets it, and a page test pins that. If Astro cannot do this for one page, the work stops and asks rather than widening the lock Site-wide.
- Python loads in a module Web Worker made from a `blob:` URL (see ADR-0010 for why a blob), so the worker is one self-contained file that finds Pyodide's files by absolute address.
- The editor is CodeMirror 6 (MIT), the minimal set, loaded with the Tool's page. It is mounted in a shadow root, because it adds its styles as a `<style>` element and the Site's style hashes block that (tested in the research: an unstyled editor otherwise). Nothing of it loads until the Tool's page opens, under "Getting ready…" (as ADR-0006).
- Loading takes 10 to 20 seconds on a laptop and is slower on a phone. It is not measured on phones yet; the real-phone ticket does that.

Planned in spec #123 (Run Python). Research: `docs/research/python-in-the-browser.md` (PR #122).
