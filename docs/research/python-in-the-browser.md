# Can the Site run Python in the visitor's browser, with a Run button and a working `input()`?

Research for a planned "Run Python" Tool (an editor, a Run button, a console where `print()` appears as it happens, and `input()` that waits for the visitor). Standard library only, no PyPI packages. Checked on 2026-11-27 against primary sources: the Pyodide docs, changelog, npm package and source; MicroPython docs and npm package; MDN and MDN browser-compat-data (BCD) v8.1.11; Apple's Safari release notes and the WebKit blog; the W3C CSP spec; the CodeMirror docs, changelog and source; GitHub's Pages docs; and the coi-serviceworker and sync-message READMEs.

Where a statement is marked **(tested)**, I ran it myself in Chromium 158 on the dev machine, serving the real `pyodide@314.0.8` npm files from a throwaway local server (not in this repo). **WebKit could not be run locally** (`docs/agents/testing.md`), so nothing below is tested on Safari or iPhone.

## Short answer

- **Use Pyodide (CPython 3.14 compiled to WebAssembly).** The current release is **314.0.8** (2026-11-13), licence **MPL-2.0**. A standard-library-only setup is five files, **13.5 MB raw, about 5.9 MB over the wire with brotli (6.3 MB with gzip)**, all self-hostable. It runs in a Web Worker, and needs a module worker. MicroPython is 25× smaller but is a subset of Python 3.4+ and lacks `itertools`, `functools`, `datetime`, `dataclasses`, `statistics` and more, so it would surprise people who expect Programiz-like behaviour.
- **For blocking `input()`, use `SharedArrayBuffer` + `Atomics.wait` in the worker, with cross-origin isolation supplied by coi-serviceworker.** It works in Chrome Android 89+ and iOS Safari 15.2+ (BCD), costs one extra page load on a visitor's first visit, and also gives a clean Stop button. **JSPI is not enough on its own yet:** Safari only shipped it in Safari 27 (2026-09-14), so any iPhone below iOS 27 lacks it. Keep it as a feature-detected fallback.
- **Stopping `while True:`:** with isolation, write 2 into the interrupt buffer (Python gets a `KeyboardInterrupt`, nothing reloads). Without it, `worker.terminate()` and start a new worker: **measured 9.0 s** here before the new runtime was ready. Hide that by starting the replacement worker as soon as the old one is killed.
- **Output:** use `setStdout({ write })` (bytes, so no line-splitting surprises) and batch what reaches the page once per animation frame. **Flush stdout before waiting for input**, or a prompt such as `print("Name: ", end="")` stays hidden (tested).
- **Editor: CodeMirror 6**, minimal set, about **125 KB gzipped**, MIT. **It must be mounted in a Shadow DOM** because the Site's style-src hashes block the `<style>` tags it injects (tested: unstyled editor in the page, correct in a shadow root).
- **CSP: `'wasm-unsafe-eval'` is enough; `'unsafe-eval'` is not needed (tested).** Safari 16+ understands it (BCD).
- **Security: visitor Python can do anything JavaScript in a worker can, including `fetch()` to other sites, unless the worker is started from a `blob:` URL.** A worker loaded from a normal URL does not inherit the page's `<meta>` CSP, so `connect-src` would not stop it (tested). Use a blob worker to keep ADR-0003's promise.

## 1. Pyodide

### Version, package, licence

- npm package `pyodide`; `latest` is **314.0.8**, published 2026-11-13. Other dist-tags: `stable-0.29` → 0.29.5, `stable-0.27` → 0.27.8, `next` → 315.0.0-alpha.2. (npm registry)
- Since 314.0.0 (2026-06-09) the first number is the Python version: "Upgraded to Python 3.14.2" and Emscripten 5.0.3. The 0.29.x line (0.29.5, 2026-09-15) is still maintained alongside. ([changelog](https://pyodide.org/en/stable/project/changelog.html))
- Licence: **MPL-2.0** (`license` field of the npm package.json). MPL-2.0 is file-level copyleft: shipping the files unmodified and crediting them on the credits page is the same duty as the Site's other libraries.
- Python runs inside a Web Worker: the docs say Pyodide "requires a module-type worker because `pyodide.asm.mjs` is an ES module", classic `importScripts()` workers are not supported, and running it on the main thread "blocks the UI". ([web worker guide](https://pyodide.org/en/stable/usage/webworker.html))

### Files for a standard-library-only setup

The docs name the minimal set as the `pyodide-core` archive, with `pyodide-lock.json` "necessary in all cases" and `pyodide.mjs` preferred over the legacy `pyodide.js`. ([downloading and deploying](https://pyodide.org/en/stable/usage/downloading-and-deploying.html)) The npm tarball holds the same files. Sizes measured from `pyodide@314.0.8` (`npm pack`):

| File | Raw | gzip -9 | brotli -q9 |
|---|---|---|---|
| `pyodide.asm.wasm` (CPython + runtime) | 9,597,892 (9.6 MB) | 3.54 MB | 3.13 MB |
| `python_stdlib.zip` | 2,545,550 (2.5 MB) | 2.50 MB | already compressed |
| `pyodide.asm.mjs` (Emscripten glue) | 1,250,259 (1.25 MB) | 0.26 MB | 0.23 MB |
| `pyodide-lock.json` (357 package entries, none needed) | 119,077 | 0.03 MB | — |
| `pyodide.mjs` (loader) | 17,758 | 0.007 MB | — |
| **Total** | **13.5 MB** | **about 6.3 MB** | **about 5.9 MB** |

Notes:

- Whether GitHub Pages sends brotli or only gzip is not documented in GitHub's Pages docs; assume the gzip figure.
- GitHub's limits are a 1 GB published site and a soft 100 GB per month of bandwidth ([Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). One 13.5 MB runtime fits easily, but every visitor who opens the Tool downloads about 6 MB once; the browser cache then serves it.
- The docs only say the host must "correctly set the WASM MIME type and CORS headers". Whether GitHub Pages serves `.wasm` as `application/wasm` should be checked on the real Site (see Open questions).
- Pyodide bundles `sqlite3` and `lzma` since 314.0.0, stubs `ssl`, and drops `test` and `pydecimal`. **Threading, multiprocessing and sockets do not work.** ([314.0.0 notes](https://pyodide.org/en/stable/project/changelog.html), [wasm constraints](https://pyodide.org/en/stable/usage/wasm-constraints.html))
- **Load time (tested, Chromium 158, localhost, desktop CPU):** `loadPyodide()` took 14-17 s the first time and 9-12 s on later runs of the same page. Phones will be slower; I did not measure one. A "Getting ready…" state is essential (see `docs/adding-a-tool.md`).
- A repo fit: serve the files from the `pyodide` npm package under a versioned folder, the way `src/site/pdfjs-files.ts` serves pdf.js data, and load `pyodide.mjs` with a dynamic `import()` only when the Tool's page is opened. Do not commit the binaries.
- The Site's ADR-0006 rejected PDFium-in-WebAssembly because the lock had no `wasm-unsafe-eval`. This Tool needs the same keyword (section 6), so the ADR's reasoning applies: say whether it is allowed site-wide or only on this page.

### Smaller alternative: MicroPython

- `@micropython/micropython-webassembly-browser` (MIT, version `1.30.0-preview.323`, 2026-11-26): `micropython.wasm` **428,586 bytes** plus `micropython.mjs` 112,173 bytes, **about 0.54 MB in total**. (npm tarball)
- Its `browser` build variant adds JSPI-based `jsffi.run_sync()` so Python can block on a promise; `runPythonAsync()` supports top-level `await`; browser interrupts "are not implemented". ([port README](https://raw.githubusercontent.com/micropython/micropython/master/ports/webassembly/README.md))
- Language coverage: MicroPython "implements Python 3.4 plus selected features from 3.5 and later", and "most Python standard library modules implement a subset". Its library index lists only: `array, asyncio, binascii, builtins, cmath, collections, errno, gc, gzip, hashlib, heapq, io, json, marshal, math, os, platform, random, re, select, socket, ssl, string.templatelib, struct, sys, time, weakref, zlib, _thread`. ([library index](https://docs.micropython.org/en/latest/library/index.html), [differences](https://docs.micropython.org/en/latest/genrst/index.html)) Not in that list: `itertools`, `functools`, `datetime`, `decimal`, `fractions`, `statistics`, `textwrap`, `dataclasses`, `typing`, `string`. (Some may exist in micropython-lib as separate installs; I did not check that route.)
- **Recommendation: Pyodide.** The people using a Programiz-style page paste in ordinary beginner programs. Real CPython behaviour, tracebacks and the full standard library matter more than an 11 MB saving. Revisit MicroPython only if the first-load cost proves unacceptable on phones.

## 2. Blocking `input()` from a worker without COOP/COEP headers

`input()` in user code is a normal synchronous call, and the page is the only place a visitor can type. So the worker has to block until the page answers.

| Approach | Needs | iPhone Safari | Android Chrome | Cost |
|---|---|---|---|---|
| **A. `SharedArrayBuffer` + `Atomics.wait`** | cross-origin isolation: COOP `same-origin` + COEP `require-corp` | Safari 15.2+ (BCD) | Chrome Android 89+ (BCD) | coi-serviceworker, one reload on first visit |
| **B. Synchronous XHR to a service worker** | service worker only | yes (sync XHR works in workers) | yes | no interrupt; service worker lifetime risk; custom plumbing |
| **C. JSPI + `pyodide.ffi.run_sync`** | JSPI in the browser | **Safari/iOS 27+ only** | Chrome 137+ (BCD) | none, but excludes older iPhones |
| **D. Rewrite `input()` as async** | AST rewrite of user code | n/a | n/a | breaks anywhere `input()` is called from sync code |

Evidence and detail:

**A. `SharedArrayBuffer` + `Atomics.wait`.** The Pyodide docs show exactly this: a worker example that calls `Atomics.wait` on a `stdinSharedBuffer` and `pyodide.checkInterrupt()` on timeouts. ([streams](https://pyodide.org/en/stable/usage/streams.html)) `setStdin({ stdin })` takes a synchronous function, so the function waits on the shared buffer while the page writes the visitor's line into it.
- Support (BCD 8.1.11): `SharedArrayBuffer` and `Atomics.wait` are in Chrome 68, Chrome Android 89, Firefox 79, Safari and iOS Safari 15.2, Samsung Internet 15. They are only exposed when the page is cross-origin isolated. ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer))
- **GitHub Pages cannot set response headers** (its docs don't list any way to; the `<meta>` tag cannot carry COOP or COEP). [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) (MIT) is "Cross-origin isolation (COOP and COEP) through a service worker for situations in which you can't control the headers". Its README says it "will reload the page on the user's first load", must be "in a separate file", "can't be loaded from a CDN: it must be served from your own origin", and needs HTTPS or localhost.
- **What it costs the rest of the Site:**
  1. On the first visit to any page under the service worker's scope, there is a reload before isolation starts. Limit the scope to the Tool page's path and register it only there. Because the file is served from `https://bwandii.io/dadstoolbox/`, its default scope is `/dadstoolbox/`, so it cannot touch other sites under `bwandii.io`.
  2. COEP `require-corp` blocks any cross-origin subresource that lacks a `Cross-Origin-Resource-Policy` header. The Site loads nothing from other origins (its CSP is `'self'` throughout), so nothing should break. Safari has no `credentialless` mode, so `require-corp` is the only choice for iPhones (BCD, from `docs/research/ffmpeg-browser-limits`).
  3. COOP `same-origin` cuts the link to cross-origin popups. The Site has no sign-in, so nothing is affected.
  4. If service workers are unavailable (some private modes or in-app browsers), isolation never starts and `input()` cannot block. The Tool must detect `crossOriginIsolated` and fall back (see recommendation).
  5. The service worker script must be an external file (the Site's CSP hashes cover only Astro's own inline scripts).
- I did not run coi-serviceworker, and WebKit was not available, so the exact combination of coi-serviceworker, a blob worker and Safari is **unverified**.

**B. Synchronous XHR + service worker.** MDN notes synchronous XHR is acceptable inside a Worker ("One of the few cases in which a synchronous request does not usually block execution is the use of `XMLHttpRequest` within a `Worker`"). ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Synchronous_and_Asynchronous_Requests)) The worker sends a sync request to a fake URL; the service worker holds the response until the page posts the line. The [sync-message](https://github.com/alexmojaki/sync-message) library implements this as a fallback and warns "browser support is still shaky"; it needs a service worker too, so it trades the reload for custom plumbing and a failure mode I could not verify (browsers stop service workers on their own schedule, and I found no primary source on how long one may hold a request open). It also gives **no way to interrupt**. Not recommended over A.

**C. JSPI.** Pyodide's `pyodide.ffi.run_sync` is "Experimental" / "This feature is not yet stable", and "only works if JS Promise integration is enabled in the runtime and the current Python call stack was entered via `pyodide.runPythonAsync()`, by calling an async Python function, or via `callPromising()`". ([ffi docs](https://pyodide.org/en/stable/usage/api/python-api/ffi.html)) `time.sleep()` also stack-switches when it can (0.29 notes).
- Browser support (BCD 8.1.11 `webassembly.jspi`): Chrome and Chrome Android 137, Edge 137, Firefox and Firefox Android 153, **Safari and iOS Safari 27**. Apple's Safari 27 release notes (released 2026-09-14, "available for iOS 27, iPadOS 27, … macOS 26") list "Added support for WebAssembly JavaScript Promise Integration (JSPI)." ([release notes](https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes.md)) The Technology Preview 238 notes show it landed in WebKit earlier, but the WebKit tracking bug [283054](https://bugs.webkit.org/show_bug.cgi?id=283054) still read "NEW" when I fetched it.
- Pyodide 314.0.8 changelog: "Stack switching now works with Safari on iOS. This drops support for iOS versions 18.0 -- 18.5". ([changelog](https://pyodide.org/en/stable/project/changelog.html)) That fix only matters once the browser has JSPI, so on iOS 26 and below it cannot work.
- **I tested C in Chromium 158:** with `builtins.input` replaced by `run_sync(js_ask(prompt))`, `input()`, `print()` and `time.sleep(0.2)` worked, with no isolation needed (tested).
- Whether iPhones still on iOS 26 or earlier are a large share of visitors is unknown. Today (2026-11-27) JSPI is only about 10 weeks old on iPhone.

**D. Async rewrite.** To `await` an `input()`, every function on the call path would need to become `async` too (and `sorted(key=…)`, class `__init__`, comprehension callbacks and `map()` cannot await). Not safe for arbitrary visitor code. Not recommended.

**Recommendation:** **A**, with C as a feature-detected fallback (`typeof WebAssembly.Suspending === "function"` when `crossOriginIsolated` is false). If neither is available, show a short message and still run programs that don't call `input()`. A is chosen because it works on every phone the Site cares about today, and because it also provides the Stop button (section 3).

## 3. Stopping runaway code

- `pyodide.setInterruptBuffer(buffer)` needs a `SharedArrayBuffer` shared between the page and the worker, and Pyodide "must run in a web worker". The page writes `2` (SIGINT) into the buffer; Python raises `KeyboardInterrupt`, and Pyodide resets the buffer to `0`. ([keyboard interrupts](https://pyodide.org/en/stable/usage/keyboard-interrupts.html), [`setInterruptBuffer` in `pyodide.d.ts`](https://www.npmjs.com/package/pyodide)) Clear the buffer before each run. Because the same isolation as approach A is already in place, the Stop button costs nothing extra.
- Without isolation there is no way to interrupt synchronous Python from outside. The only option is `worker.terminate()` and a new worker, which discards variables and the loaded runtime.
- **Reload cost (tested):** after `while True: pass` ran for 1 s, `terminate()` followed by a new worker was ready (`loadPyodide` resolved, ready to run) after **9.0 s** wall time in headless Chromium 158 on a desktop CPU. That was with the same local files, so the download was cheap; the time is compiling the 9.6 MB wasm and initialising Python. A phone will be slower, unmeasured.
- Mitigation (my suggestion, not tested): start the replacement worker the moment the old one is killed, so the 9 s runs while the visitor edits the code; show "Getting ready…" only if they press Run before it is done.
- Memory runaway (`x = [0] * 10**10`) is not an interrupt case: the worker simply fails. The unreleased changelog entry for a `maxMemoryBytes` option of `loadPyodide` ("Once the total heap reaches the limit, further allocations fail with a `MemoryError`") is **not in 314.0.8**.

## 4. Streaming output and tracebacks

- `setStdout` / `setStderr` accept three handler shapes. **`batched`** gets "a complete line with the newline removed, or a flushed partial line"; **`raw`** gets one character code per call and is "neither very convenient nor very efficient"; **`write`** gets a `Uint8Array` and returns the byte count. The browser default is `batched` calling `console.log`. `isatty: true` cannot be combined with `batched`. ([streams](https://pyodide.org/en/stable/usage/streams.html))
- **Recommendation: `write`, decoded with a streaming `TextDecoder` (`{ stream: true }`).** It keeps partial lines and multi-byte characters intact, and keeps `print("x", end="")` text. In the worker, `postMessage` the chunks; on the page, append them to a string buffer and flush it into the DOM once per `requestAnimationFrame`. A `while True: print(i)` loop would otherwise post tens of thousands of messages a second and freeze the page. Insert output with `textContent`, never `innerHTML`.
- **Flush before waiting for input (tested).** In the test, `print("Name: ", end="")` followed by `input()` showed nothing until after the visitor answered, because Python's stdout buffer held the text. The `input` replacement should call `sys.stdout.flush()` before asking.
- **Tracebacks (tested):** `runPythonAsync` raises a `PythonError` whose message includes internal Pyodide frames (`_pyodide/_base.py`, `run_async`) before the visitor's `File "<exec>", line 6, in <module>`. For clean output, run the visitor's code from Python (`compile(code, "main.py", "exec")` then `exec`), catch the exception there, and print `traceback.format_exception` with the frames above the visitor's file cut. I did not build this.
- Stdin default: in a browser, the default is `stdin: () => prompt()`; replace it, or `input()` would open a browser dialog. Returning `undefined` from the callback is EOF (`EOFError`). ([streams](https://pyodide.org/en/stable/usage/streams.html))

## 5. The code editor

**CodeMirror 6** (MIT; `@codemirror/state` 6.7.6, `view` 6.44.2, `commands` 6.11.2, `language` 6.13.1, `lang-python` 6.2.1, all MIT per npm). Python support is `@codemirror/lang-python`, built on the Lezer Python grammar.

Measured by bundling with esbuild (`--minify`, ESM):

| Bundle | Raw | gzip | brotli |
|---|---|---|---|
| `codemirror` `basicSetup` + `python()` | 467 KB | 155 KB | 132 KB |
| minimal: line numbers, history, default keymap, Tab indent, default highlight style, `python()` | 371 KB | 125 KB | 107 KB |

That is small next to the 6 MB runtime, so load it with a dynamic `import()` on this Tool's page only.

- **Mobile:** CodeMirror's front page says it uses "the platform's native selection and editing features on phones", and its changelog shows steady 2026 touch and keyboard fixes: iOS own selection handles, iOS Shift-Enter and Backspace, Android cursor scroll, composition near widgets, and a Safari shadow-DOM copy/cut fix (view 6.39.14-6.41.0). ([view CHANGELOG](https://raw.githubusercontent.com/codemirror/view/main/CHANGELOG.md)) I could not test on a phone.
- **CSP trap (tested):** CodeMirror adds its styles by creating a `<style>` element in the document. The Site's `<meta>` CSP is built by Astro with style-src **hashes**, which block that element. In Chromium with `style-src 'self' 'sha256-…'` the editor logged a `style-src-elem` violation and rendered unstyled (gutters as plain blocks, no highlight colours). **Mounted inside a shadow root**, `style-mod` switches to `adoptedStyleSheets`, there was no violation, and gutters and Python highlighting rendered correctly. (`style-mod` source: a constructable sheet is used when the root has no `head`.) A nonce is not an option on a static host (`EditorView.cspNonce` needs a per-request value). `'unsafe-inline'` would be ignored next to hashes.
- **Plain `<textarea>` + highlight overlay:** zero download and the native phone keyboard, but it needs a hand-built layer that stays pixel-aligned with the text on every scroll, resize, wrapped line and font setting, and has no auto-indent after `:`, no bracket handling, no undo-aware Tab key. Those matter for Python, where indentation is syntax. I did not find a primary source that measures its mobile quality, so this is judgement, not a finding.
- **Recommendation: CodeMirror 6, minimal set, in a shadow root.** The textarea is a reasonable fallback if the shadow-root route fails on WebKit (untested).

## 6. CSP

- Current Site CSP (`src/site/csp.ts`): `default-src 'self'`, `worker-src 'self' blob:`, `connect-src 'self' blob: data:` (plus declared outside addresses). Astro adds `script-src` and `style-src` hashes. There is no `wasm-unsafe-eval`.
- **WebAssembly compilation is blocked unless `script-src` has `'wasm-unsafe-eval'` or `'unsafe-eval'`** (CSP3 § 4.5.1: the byte-compilation check is skipped only when the policy's script source list includes either). ([W3C CSP3](https://www.w3.org/TR/CSP3/)) `'wasm-unsafe-eval'` is supported from Chrome and Chrome Android 97, Safari and iOS Safari 16, Firefox 102 (BCD `http.headers.Content-Security-Policy.script-src.wasm-unsafe-eval`).
- **Pyodide does not need `'unsafe-eval'` (tested).** The Emscripten glue contains `eval(` calls, but Pyodide 314.0.8 ran fully, including `print`, `input()`, a traceback and `time.sleep`, with `script-src 'self' blob: 'wasm-unsafe-eval'` and no violations, in a blob worker (below). The changelog's old note that Safari lacks `wasm-unsafe-eval` dates from 0.21.x (Safari 16 has it since). ([changelog](https://pyodide.org/en/stable/project/changelog.html))
- **Where the keyword is needed depends on how the worker starts (tested):**
  - A worker loaded from a normal URL (`new Worker("/worker.js")`) runs under its own response headers, not the page's `<meta>` CSP. In Chromium, with CSP only on the HTML, Pyodide ran in a URL worker even with `script-src 'self'` alone.
  - A worker created from a **`blob:` URL inherits the creating page's CSP**, so there `'wasm-unsafe-eval'` is required: with it missing, `loadPyodide()` never settled (no error), and with it present Pyodide loaded in 11.7 s. (Pyodide 314.0.8 hangs when `pyodide.asm.wasm` fails to load; a fix is in the unreleased changelog.)
  - I did not find CSP3's "initialize a global object's CSP list" text for workers in the part of the spec I could fetch, so the inheritance rule above rests on those tests, not on quoted spec text. Confirm on WebKit.
- A blob worker has no base URL, so the code must import `pyodide.mjs` and set `indexURL` with absolute URLs (`location.origin + base + …`).
- For the Site this means `script-src` gains `'wasm-unsafe-eval'` on this Tool's page (or the Site's pages as a whole). Astro's `security.csp.directives` takes the Site-wide list from `cspDirectives()`; a per-page change would need an Astro-side override. `worker-src 'self' blob:` already allows both worker styles.

## 7. Security notes for the owner

What visitor-written Python **can** reach:

1. **Everything JavaScript in that worker can.** Pyodide's `js` module exposes "JavaScript objects in the `globalThis` global scope" to Python, and Python can write to them. ([type conversions](https://pyodide.org/en/stable/usage/type-conversions.html)) So `import js; js.fetch(...)`, `js.postMessage(...)` and `js.indexedDB` are all callable.
2. **Other websites, unless the worker is a blob worker (tested).** From a worker loaded from a normal URL, `fetch("https://example.com/", { mode: "no-cors" })` succeeded while the page's `<meta>` CSP said `connect-src 'self'`. From a blob worker with the same CSP, the same fetch failed (`TypeError: Failed to fetch`), and so did `await js.fetch(...)` from Python in the Pyodide blob worker. Without the blob worker, ADR-0003's promise ("a person's files are never … sent anywhere") would not be enforced by the browser for this Tool. A visitor running a program someone else gave them could be sent anywhere; **the blob worker is the main protection.** Apply the same rule to any other Tool that runs visitor-supplied code.
3. **Same-origin content.** Allowed by `connect-src 'self'`, Python can `fetch` any page of the Site and anything else under the same origin. `astro.config.ts` has `site: 'https://bwandii.io'`, so check what else is served from `bwandii.io`: same-origin pages, IndexedDB and the Cache API are shared across everything on that origin, and a service worker scoped to the whole origin would also see them.
4. **The page, through messages only.** A worker cannot touch the DOM; it can only `postMessage` to the page. The page must treat every message as untrusted: render output as text, never as HTML, and accept only the message types it defines.
5. **The visitor's CPU and memory.** A worker can use a core indefinitely and grow memory until the tab crashes; `maxMemoryBytes` is not in 314.0.8. The Stop button and a visible "Running…" state are the controls.

What it **cannot** reach:

- **The visitor's files and folders.** Pyodide's default file system is MEMFS, "a virtual in-memory file system" whose contents are "lost when the page is reloaded". `mountNativeFS` is experimental, works only in Chromium browsers, and needs `showDirectoryPicker()` plus a permission grant. ([file system](https://pyodide.org/en/stable/usage/file-system.html)) That picker is a window API, so the Site would have to call it deliberately. Python cannot call it by itself from a worker.
- **The main page's variables, DOM, cookies and `localStorage`.** A worker has its own global scope; "you cannot directly share globals between a worker and the main thread" and "a worker cannot directly manipulate the DOM". ([web worker guide](https://pyodide.org/en/stable/usage/webworker.html)) `document.cookie` and `localStorage` are not defined in workers. (MDN, workers cannot use them; I did not fetch that page.)
- **Sockets and processes.** `socket`, `threading` and `multiprocessing` are "included but not working"; "all network calls are done via the browser". ([wasm constraints](https://pyodide.org/en/stable/usage/wasm-constraints.html))
- **Anything outside the browser sandbox:** no OS, no shell, no other tabs.

What does the Site store? If the Tool saves code to `localStorage`, it is only that visitor's own browser, and it must not be sent anywhere (ADR-0003). A "share a link" feature (code in the URL hash) would also be fine without a server.

## Suggested design, in one paragraph

Load Pyodide 314.0.8 from the Site's own files, lazily, in a **blob module worker**. Have a coi-serviceworker (scoped to the Tool page) turn on cross-origin isolation; use `Atomics.wait` for `input()` and an interrupt buffer for Stop; fall back to JSPI where isolation is missing and the browser supports it. Stream stdout with `write`, batched per frame, flush before asking. Edit with CodeMirror 6 in a shadow root. Add `'wasm-unsafe-eval'` to `script-src` for the page.

## Open questions (need a prototype, not more reading)

- **Safari and iPhone, untested:** coi-serviceworker plus a blob worker plus `SharedArrayBuffer`; blob workers inheriting the meta CSP; CodeMirror in a shadow root; `loadPyodide` time and memory on a mid-range Android phone and a recent iPhone. WebKit's Docker route in `docs/agents/testing.md` is the way to start.
- **Does GitHub Pages serve `.wasm` as `application/wasm`**, and does it send brotli or gzip? Neither is in GitHub's docs.
- **First-visit reload:** how bad is the one-time reload for a visitor arriving straight on the Tool's page, and is a "Click to start" button better than reloading automatically?
- **JSPI share:** how many visitors are on iOS 26 or earlier? Decides whether C is worth building at all.
- **What else is served from `bwandii.io`** (see 7.3).
- **Site-wide or Tool-only `wasm-unsafe-eval`:** needs a small ADR (supersedes the reasoning in ADR-0006), since the lock is currently the same on every page.
