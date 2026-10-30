# What are ffmpeg's real limits in the browser?

Research for issue #2 (map #1). Checked on 2026-10-29 against primary sources: ffmpeg.wasm docs, its npm packages and source, MDN, MDN browser-compat-data (BCD) v8.1.7 (2026-10-22), caniuse, WebKit, and library READMEs.

## Short answer

- **ffmpeg.wasm works in every current browser, including iOS Safari, but only the single-threaded build works without special headers.** The single-thread core needs no COOP/COEP headers. The multi-thread core needs `SharedArrayBuffer`, so the host must send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.
- **Each visitor downloads about 31-32 MB of wasm once, or about 9-10 MB over the wire with brotli or gzip.**
- **It is slow.** On a 2021 laptop, a webm→mp4 transcode ran about 25× slower than native ffmpeg single-threaded, and about 12× slower multi-threaded.
- **The hard ceiling is 2 GB for the input.** On phones, memory will run out well before that. The multi-thread build reserves a fixed 1 GiB of memory up front and starts a pool of 32 workers, which makes it a poor fit for phones.
- **Many common jobs have a lighter browser-native route:** WebCodecs via Mediabunny for video and audio, canvas for images, and a small GIF encoder for mp4→gif. Keep ffmpeg.wasm as the fallback for formats those can't handle.

## 1. Current state of ffmpeg.wasm

- The packages are `@ffmpeg/ffmpeg` (the wrapper), `@ffmpeg/core` (single-thread), and `@ffmpeg/core-mt` (multi-thread). Work runs in a web worker by default. [Overview](https://ffmpegwasm.netlify.app/docs/overview)
- Latest npm versions: `@ffmpeg/ffmpeg` 0.12.15, `@ffmpeg/core` / `@ffmpeg/core-mt` 0.12.10. The latest GitHub release (core v0.12.10) is dated 2025-01-07. The repo was still receiving commits in 2026-09, but they were docs and typo fixes. In short, the project is stable but slow-moving. (npm registry; `gh api repos/ffmpegwasm/ffmpeg.wasm`)
- **License:** the wrapper is MIT, but `@ffmpeg/core` is **GPL-2.0-or-later** (npm `license` field), because ffmpeg is built with GPL libraries such as x264. That is fine for a free site, but the Site must comply with the GPL: link to the source and keep the notices.

## 2. Download size of the core

Measured from jsDelivr (`@ffmpeg/core@0.12.10/dist/esm`):

| File | Raw | Over the wire |
|---|---|---|
| `core` `ffmpeg-core.wasm` | 32.2 MB | 9.3 MB brotli / 10.3 MB gzip |
| `core-mt` `ffmpeg-core.wasm` | 32.7 MB | (similar) |
| `ffmpeg-core.js` glue | 0.11–0.13 MB | — |

The official usage page labels its load button "Load ffmpeg-core (~31 MB)". [Usage](https://ffmpegwasm.netlify.app/docs/getting-started/usage) A custom build that includes only the needed libraries (for example, only x264) can shrink the wasm. [Overview](https://ffmpegwasm.netlify.app/docs/overview) Implication: load the core lazily, only when a visitor opens a media Tool, and let the browser or service worker cache it.

## 3. Speed

The official benchmark was `ffmpeg -i input.webm output.mp4`, run on an i5-1135G7 laptop in Chrome 116 with core v0.12.3. [Performance](https://ffmpegwasm.netlify.app/docs/performance)

| | Native | core (single-thread) | core-mt |
|---|---|---|---|
| Avg | 5.2 s | 128.8 s (0.04×) | 60.4 s (0.08×) |

The FAQ says: "WebAssembly is still a lot slower than native", and the multi-thread build gives "around 2x speed" but is less stable and uses more memory and CPU. [FAQ](https://ffmpegwasm.netlify.app/docs/faq)

**Mid-range phone:** I found **no official or first-party benchmark**. Phone CPUs are slower than that laptop, and the single-thread build gets no help from extra cores, so expect a full re-encode to be several times slower again. Treat any full video re-encode longer than a short clip as minutes, not seconds. This needs a quick prototype measurement on a real mid-range Android phone and an iPhone before committing. Remuxing with `-c copy`, with no re-encode, is far cheaper and is the realistic phone use case.

## 4. File size and memory limits

- FAQ: the maximum input file size is "2 GB, which is a hard limit in WebAssembly." [FAQ](https://ffmpegwasm.netlify.app/docs/faq)
- From the shipped glue code (`ffmpeg-core.js` 0.12.10):
  - **Single-thread:** the wasm heap grows on demand up to `getHeapMax() = 2147483648` (2 GiB).
  - **Multi-thread:** `INITIAL_MEMORY = 1073741824` (1 GiB), with `initial` equal to `maximum`. That is a fixed 1 GiB shared heap allocated at load, plus `pthreadPoolSize=32` pre-spawned workers. That is heavy for phones.
- By default, files go in an in-memory filesystem (`writeFile`/`readFile`), so input, output, and heap all sit in RAM at once. The API also exposes `mount()` with `FFFSType.WORKERFS`, which reads a user's `File` without copying it into memory. ([types.ts](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/packages/ffmpeg/src/types.ts), [FFmpeg class](https://ffmpegwasm.netlify.app/docs/api/ffmpeg/classes/FFmpeg))
- Safari 15.2 raised the wasm addressable memory to 4 GB. [WebKit 15.2](https://webkit.org/blog/12140/new-webkit-features-in-safari-15-2/) **Per-tab memory caps on iOS and Android are not documented by WebKit or Chromium.** In practice, the realistic phone limit is "short clips, roughly a few hundred MB", but that is unverified and should be prototyped. Long-standing ffmpeg.wasm issues report out-of-memory errors on mobile ([#78](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/78), [#119](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/119)).
- `exec(args, timeout)` and `terminate()` exist, so a Tool can cancel a runaway job. Progress events "are accurate only when the length of input and output video/audio file are the same." [FFmpeg class](https://ffmpegwasm.netlify.app/docs/api/ffmpeg/classes/FFmpeg)

## 5. Single vs multi-thread, and what the host must provide

- **Single-thread (`@ffmpeg/core`):** needs no special headers. It works on any static host over HTTPS.
- **Multi-thread (`@ffmpeg/core-mt`):** "SharedArrayBuffer is required for multithread version". [Usage](https://ffmpegwasm.netlify.app/docs/getting-started/usage) Using shared memory requires a **secure context** and **cross-origin isolation**. [MDN SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) The headers are:

  ```http
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```

  COEP may also be `credentialless`, and isolation must not be blocked by `Permissions-Policy: cross-origin-isolated`. [MDN COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)
- **`credentialless` does not work in Safari or iOS Safari** (BCD: Chrome 96, Firefox 119, Safari ✗, Safari iOS ✗). So for iPhone users, the header has to be `require-corp`. Under `require-corp`, every cross-origin subresource (CDN scripts, fonts, images, embeds) must send `Cross-Origin-Resource-Policy` or be loaded with CORS. [MDN COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy) Self-hosting the ffmpeg core files avoids that. The docs' `toBlobURL` trick is there "to bypass CORS issue". [Usage](https://ffmpegwasm.netlify.app/docs/getting-started/usage)
- **Browser support for COOP/COEP plus SharedArrayBuffer** (BCD / caniuse): Chrome and Chrome Android 83+ for the headers (SharedArrayBuffer since 68), Firefox 79+, Safari and iOS Safari 15.2+, Samsung Internet 13+. [caniuse SharedArrayBuffer](https://caniuse.com/sharedarraybuffer)
- **Hosts that can't set headers** (for example GitHub Pages) can use [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) (MIT). It is a same-origin service worker that adds the headers, at the cost of a page reload on the first visit. Hosts with a headers file, such as Cloudflare Pages `_headers`, can set them directly. [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- COOP `same-origin` also cuts the link to cross-origin popups, which affects things like OAuth popups. That doesn't matter here, since the Site has no sign-in.

**Recommendation for the decisions downstream:** ship the **single-thread** core first. That means no header requirement, and it works on phones and every host. Multi-thread is an optional upgrade for desktop, about 2× faster, behind `crossOriginIsolated`. Even so, the chosen host *should* be able to set custom response headers, either natively or via coi-serviceworker, so that option stays open.

## 6. Lighter browser-native routes

**WebCodecs** gives hardware-accelerated encode and decode with no 31 MB download. BCD support:

| API | Chrome / Android | Firefox desktop | Firefox Android | Safari / iOS | Samsung |
|---|---|---|---|---|---|
| VideoEncoder/Decoder | 94 | 130 | ✗ | 16.4 | 17 |
| AudioEncoder/Decoder | 94 | 130 | ✗ | 26 | 17 |
| ImageDecoder | 94 | 133 | 133 | ✗ (preview only) | 17 |

caniuse marks Safari 16.4–18.7 as partial and full support from Safari 26. [caniuse WebCodecs](https://caniuse.com/webcodecs) WebCodecs only handles codecs. It does not read or write containers, so a muxing/demuxing library is needed alongside it.

- **[Mediabunny](https://mediabunny.dev/guide/introduction)** (MPL-2.0, ~7.4k stars, active 2026-10) is the current mainstream library for this. It reads and writes mp4, mov, webm, mkv, mp3, wav, ogg, aac, flac and ts, and offers transmux, transcode, resize, crop, rotate and trim, all on top of WebCodecs. Encode support depends on the browser and can be checked at runtime with `canEncode` / `getEncodableCodecs`. MP3 and FLAC encoding need the `@mediabunny/mp3-encoder` / `flac-encoder` polyfills, and AAC encoding needs a polyfill in some browsers. [Supported formats](https://mediabunny.dev/guide/supported-formats-and-codecs) It does not mention GIF.
- **mp4 → gif:** neither WebCodecs nor Mediabunny encodes GIF. The route is to decode frames (Mediabunny, or `<video>` drawn to a canvas, which works everywhere) and then encode with a small GIF encoder such as [gifenc](https://github.com/mattdesl/gifenc) (MIT). This avoids the ffmpeg download, though ffmpeg's `palettegen` gives better colour quality.
- **Image conversion:** `canvas.toBlob` / `OffscreenCanvas.convertToBlob` encode PNG and JPEG everywhere. **WebP encoding is not supported in Safari or iOS Safari** (BCD `type_parameter_webp`: Chrome 50, Firefox 96, Safari ✗). WebP output on iPhone would need a wasm encoder. Decoding any format the browser can display (including HEIC on Safari) works through `<img>` / `createImageBitmap`.

## 7. Suggested Tool strategy

1. Use **canvas** for image Tools.
2. Use **Mediabunny + WebCodecs** for common video and audio jobs (trim, compress, convert between mp4 and webm, extract audio), with feature detection.
3. Use **frames + gifenc** for mp4→gif.
4. Use **ffmpeg.wasm single-thread**, lazy-loaded, for anything else (odd formats, filters), and for Firefox Android, which lacks WebCodecs. Warn about file size and time on phones.

## Open questions (need a prototype, not more reading)

- Real wall-clock time and the out-of-memory threshold for ffmpeg.wasm and for Mediabunny on a mid-range Android phone and a recent iPhone.
- Whether the 1 GiB fixed allocation of `core-mt` even succeeds on iOS Safari.
