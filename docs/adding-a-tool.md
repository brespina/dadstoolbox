# Adding a Tool

How to add a Tool to the Site, for a future maintainer or an agent. It uses the terms in
[GLOSSARY.md](../GLOSSARY.md): a **Tool** is one task, it sits in one **Category**, a
**Batch** is the results from one press of the start button, and the **Promise** is what
the Site guarantees every visitor. `run` is only the name of a Tool's function; don't
call a Batch "a run".

Read [ADR-0001](adr/0001-tools-run-in-the-browser.md) (Tools run in the visitor's
browser) and [ADR-0003](adr/0003-the-site-keeps-no-data-about-visitors.md) (the Site keeps
no data about visitors) first. A Tool that needs a server or sends files anywhere can't
be added.

## The steps

1. **Copy the template.** Copy `src/tools/_template/` to `src/tools/<address>/`, where
   `<address>` is the Tool's address in plain words, such as `photo-to-jpg`. Drop the
   leading `_`: folders starting with `_` are skipped everywhere, which is why the
   template never shows on the Site.
2. **Fill the declaration** in `declaration.ts` (every field is described
   [below](#the-declaration)). Set `address` to the folder's name.
3. **Write `run`** in `run.ts` (see [the `run` contract](#the-run-contract)), and the
   options in `Options.svelte`.
4. **Add a sample file** named `sample.<ext>`, such as `sample.pdf`. Keep it small. The
   generated page test chooses it, so it must be a file the Tool handles. Delete the
   template's `sample.txt`.
5. **Add the thin page** at `src/pages/<address>.astro`:

   ```astro
   ---
   import ToolLayout from '../layouts/ToolLayout.astro';
   ---

   <ToolLayout address="<address>" />
   ```

6. **Write one Vitest test of `run`** in `run.test.ts`, next to `run.ts`. Rewrite the
   template's test for the new Tool (see [Testing](#testing)).
7. **Run the checks**: `npm run check`, `npm run format:check`, `npm test` and
   `npm run test:e2e`.

**The folder name, the `address` field and the page file name must be the same.** The
shared Tool page finds `run.ts` and `Options.svelte` by the address, and the page finds
the declaration by it. A mismatch breaks the build or the page.

There is no central list to edit. The Site finds every Tool by its `declaration.ts`
(`src/tools/registry.ts` at build time; `src/tools/discover.ts` from plain Node), so the
new Tool shows on the home page under its Category and gets its own page test on its own.

## The folder

| File             | What it holds                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `declaration.ts` | The declaration, made with `defineTool`. **Plain data only**: no Svelte, CSS, asset or library imports. Plain Node imports it for the browser lock and the generated page test. |
| `run.ts`         | Exports `run`, the Tool's job, in plain TypeScript. Its libraries load only on the Tool's own page.                                                                                  |
| `Options.svelte` | The Tool's options, shown above Choose.                                                                                                                                              |
| `run.test.ts`    | The Vitest test of `run`.                                                                                                                                                            |
| `sample.<ext>`   | The file the generated page test chooses. Extra test files, such as `sample-password.pdf`, can sit beside it. For input mode `none`, `sample.txt` holds the text the test types, or, with no type box, `sample.json` holds each field's value by its label. |
| `ready.ts`       | Optional. Lines for a chosen file's Ready row, such as an estimated size. See [Notes on the Ready row](#notes-on-the-ready-row).                                                   |
| `FileOptions.svelte` | Optional. An editor on each chosen file's Ready row, for options that belong to that file. See [Options for each file](#options-for-each-file). |

`src/tools/types.ts` defines the declaration and `run` types. It is the source of truth:
if this guide and that file disagree, the file wins. `src/tools/split-pdf/` is a worked
example.

## The declaration

`defineTool` fills the defaults for the fields marked optional below (`largeFileNote`,
`privacyLine`, `allDone`, `textFor`, `typeLabel`, `typeBox`, `reasons`, `notes`,
`fileOptions` and `optionsProblem`). Every other
field is required.

| Field              | What it does                                                                                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `address`          | The Tool's flat address in plain words, such as `split-pdf`. The page is `…/dadstoolbox/<address>/`. Categories are not part of it.                                                                                                                                                                |
| `name`             | The Tool's name, written as a task: "Split a PDF", "Change a photo to JPG". The page heading and home page row.                                                                                                                                                                                   |
| `blurb`            | One line in everyday words that names the visitor's problem: "iPhone photo won't open or upload?".                                                                                                                                                                                                 |
| `category`         | One of the fixed Categories, in order: `Photos`, `PDFs`, `Video`, `Other`.                                                                                                                                                                                                                         |
| `position`         | Order within the Category, lowest first. Keep it unique within the Category.                                                                                                                                                                                                                       |
| `noun`             | What the Tool takes, as `{ one, many }`, such as `{ one: 'PDF', many: 'PDFs' }`. Used in the privacy line, the Choose button ("Choose PDFs") and Batch labels ("3 PDFs").                                                                                                                         |
| `accept`           | File types for the Choose button: types such as `application/pdf` and endings such as `.pdf`. List both, because phones are not consistent.                                                                                                                                                        |
| `input`            | The input mode: `each`, `together` or `none`. See [Input modes](#input-modes).                                                                                                                                                                                                                     |
| `needs`            | Browser features `run` needs: `webcodecs` (reading video) and `makeVideo` (making video). They are checked when the page runs. Where one is missing, the home page row and the Tool page say "Doesn't work on this browser yet" and Choose is greyed out. Add a new feature to the `BrowserFeature` type in `types.ts` if it is missing. |
| `largeFileLimit`   | A size in bytes. A file bigger than this gets a note on its Ready row warning it may be slow or stop partway on a phone. It does not stop the file. Set it from what a phone can really handle.                                                                                                    |
| `largeFileNote`    | Optional. That note. Defaults to "This {noun} is big for a phone. It may take a few minutes or stop partway." with the Tool's noun (one) swapped in.                                                                                                                                          |
| `typeLabel`        | Optional, for input mode `none`. The label on the box the visitor types into. Has a shared default.                                                                                                                                                                                              |
| `typeBox`          | Optional, for input mode `none`. Defaults to `true`. Set it to `false` when the options hold all the input, as in Make a Wi-Fi QR code: the page shows no type box, and the result is made again whenever the options change. See [Input modes](#input-modes). |
| `startButton`      | Words on the start button that say what will happen: "Split into pages", "Combine PDFs".                                                                                                                                                                                                          |
| `privacyLine`      | Optional. Defaults to the Promise line with the noun swapped in: "Your PDFs stay on your device. They are never sent anywhere." A Tool with no file says something like "What you type stays on your device."                                                                                    |
| `allDone`          | Optional. Shown when a Batch finishes. Defaults to "All done."                                                                                                                                                                                                                                     |
| `textFor`          | Optional. A function from the options to words that follow them: `startButton` ("Change to PNG"), `batchLabel` (the "PNG" in "PNG · 3 photos"), `allDone`, and for input mode `none`, `pictureLabel` (the result picture's description, which defaults to "{noun} that says: {typed}"). Each one left out falls back to the field above. With default options it must give the same `startButton`, because the page test presses that. |
| `reasons`          | Optional. The Tool's own plain-language failure reasons, by key. `run` throws them as `ToolFailure` (see below).                                                                                                                                                                                  |
| `notes`            | Optional. Other words the Tool shows, by key, such as its option names or the lines its `ready.ts` gives. They are scanned for plain words like every other field.                                                                                                                             |
| `worker`           | Whether `run` runs in a Web Worker. See [The worker flag](#the-worker-flag).                                                                                                                                                                                                                       |
| `outsideAddresses` | Outside origins the Tool may contact. Leave it empty. See [Outside addresses](#outside-addresses).                                                                                                                                                                                                 |
| `fileOptions`      | Optional, for input mode `each`. The option names each chosen file has its own value for, such as `['start', 'end']`. Defaults to none. See [Options for each file](#options-for-each-file). |
| `optionsProblem`   | Optional. Given a file's options, the plain words for why start can't run it yet, or `undefined`. Start stays greyed out and the words show on the file's Ready row. Defaults to no problem. |
| `defaultOptions`   | The options the page starts with. Their shape is the options type for `run` and `Options.svelte` (`typeof tool.defaultOptions`).                                                                                                                                                                  |

## Input modes

- **`each`, each file on its own** (Split a PDF, Change a photo to JPG). `run` is called
  once per file, with that file and the options. Each file has its own row, so one file
  that fails doesn't stop the others.
- **`together`, all files together** (Combine PDFs). `run` is called once with the
  ordered list of every waiting file. The waiting list gets ↑ / ↓ buttons to set the
  order. Results are named after `combined` instead of an original, as in
  `combined_dtb.pdf`.
- **`none`, no file** (Make a QR code). The visitor types instead, and `run` gets the
  typed text. There is no Choose or start button: the result updates as the visitor types
  and is saved like any other result. Leave `accept` empty and write the privacy line
  about what they type.

  A Tool whose options hold all the input (Make a Wi-Fi QR code: a network name and a
  password) sets `typeBox: false`. The page hides the type box, `run` gets `""` as the
  typed text and reads everything from the options, and the result is made again
  whenever the options change. `run` returns `[]` while there is nothing to make yet,
  such as an empty network name: the page then shows no result and no reason. Give
  `textFor` a `pictureLabel`, so the picture is described from the options, without
  anything private such as a password.

The template uses `each`. Each mode has its own `run` type in `types.ts`: `ToolRun`
(`each`), `ToolRunTogether` (`together`) and `ToolTextRun` (`none`). Combine PDFs and
QR code maker are the worked examples for `together` and `none`, and Make a Wi-Fi QR code
for `none` with no type box. The QR code Tools share their drawing, `qrPng` in
`src/qr/draw.ts`.

## The `run` contract

`run` takes the input (one file, the ordered list of files, or typed text, by input mode)
and the options. It returns a list of results:

```ts
{ blob: Blob; detail?: string }
```

- **`blob`** is the result's bytes. Its type, such as `application/pdf`, sets the file
  extension. Shared code knows the types in `extensions` in `src/tools/running.ts`; any
  other type keeps the original file's extension (a typed Tool's result gets none).
- **`detail`** is added to the name, as in `report_dtb_page3.pdf`. Shared code builds
  every name as `<original>_dtb[_<detail>].<ext>` and adds `_2`, `_3` for repeats, so a
  result never overwrites an original. Don't build names in `run`.
- One input can give any number of results (Split a PDF gives one per page).

**Failing.** When `run` knows what went wrong, throw `new ToolFailure(tool.reasons.<key>)`
with a reason from the declaration. It shows on that file's row as "Didn't work. <reason>".
Write what's wrong and what to try, with no blame: "This PDF has a password. Remove it and
try again." Any other error shows the shared fallback, "This file may be damaged or not
supported.", and its detail goes only to the console. Don't catch errors just to hide
them.

**Photos.** Open a photo with `openPhoto` (`src/photos/open.ts`): it turns the photo the
right way up and opens iPhone photos (HEIC) where the browser can't. To draw one as a JPG
with no photo details, no bigger than a longest side, use `shrinkOnCanvas`
(`src/photos/shrink.ts`), as Make a photo smaller and Photos to one PDF do. It needs the
page, so those Tools set `worker: false`.

**Progress.** Shared code shows "Working on 2 of 5…" as it works through the files, so
`run` needs to report nothing. For a file that takes a while, `run` may also call
`context.progress(fraction)` with how far along that file is, from 0 to 1; its row then
shows "Working… 40%", and the live region hears it at 25%, 50% and 75% only. Call it as
often as you like, in the page or in a worker: only a new whole percent is sent or shown.
A Tool that never calls it shows plain "Working…". Every Tool that calls `remakeVideo`
passes it on (see [Remaking a video](#remaking-a-video)).

**Loading.** Import libraries in `run.ts`, never in `declaration.ts`. A small library can
load with the page. A big one (such as a video library or a fallback photo decoder)
should load only once a file is chosen, with a dynamic `import()` inside `run`; the page
shows "Getting ready…" while it loads if `run` wraps the load in
`context.gettingReady(...)` (see `src/tools/video-to-gif/run.ts`). Bundle every library and file from npm or the Site
itself. Never load anything from another site.

## The worker flag

Set `worker: true` when `run` does heavy work that would freeze the page, such as
building a gif. Shared code then runs `run` in a Web Worker through Comlink, so the page
stays responsive. In that case `run` can't use the page: no `document`, `window` or DOM
elements. `OffscreenCanvas`, `createImageBitmap` and `fetch` to the Site are fine. The
Tool doesn't make the worker itself; shared code does. Most Tools use `worker: false`.
Make a gif from a video (`src/tools/video-to-gif/`) is the worked example.

The worker's files hold only the Tools marked worker, and the page's files only the
others (`src/tools/tool-runs.ts` sorts them when the build starts). After changing a
Tool's `worker` flag, restart the dev server.

The worker's shared code (`src/tools/worker.ts` and what it imports, such as
`ToolFailure`) is built into its own file, `worker-shared` (see `astro.config.ts`). If a
Tool's `run` file imported the worker's entry file instead, Safari would run the entry a
second time, and a Tool's plain reasons would show as the shared fallback.

A worker loaded from its own file does not get the page's browser lock tag, so a worker
Tool must not fetch anything itself. The page tests watch requests from workers too.

## Remaking a video

A Tool that saves a video calls `remakeVideo` from `src/video/remake.ts`, the shared
video module. It remakes the video as an H.264 MP4 with AAC sound, the picture size
kept, and copies sound that is already AAC. Other sound, such as Opus, is remade as
AAC with the browser's own sound features. It asks first whether the browser can make
this video, and reads the first bit of any sound it remakes, and fails with a plain
reason rather than save a video missing its picture or sound, or stay on Working… Make a video play anywhere (`src/tools/video-to-mp4/`) is the worked example:

- Spread `videoReasons` (`src/video/reasons.ts`) into the declaration's `reasons`, and
  pass `tool.reasons` to `remakeVideo`.
- Set `needs: ['webcodecs', 'makeVideo']` and `worker: true`.
- Import the module inside `run` with a dynamic `import()` under `context.gettingReady`,
  as Mediabunny is big.
- `longestSide` fits the picture's longest side to that many pixels, never larger (Make a
  video smaller). `fitLongestSide` in `src/video/size.ts` gives the size it makes, for an
  estimate.
- `range` keeps only the part from `start` to `end` (seconds), cut exactly (Trim a
  video). Its values come from the file's own options (see
  [Options for each file](#options-for-each-file)).
- `onProgress` is called with how far along the video is, from 0 to 1. Pass
  `onProgress: (f) => context?.progress(f)` so the file's row shows "Working… 40%" (see
  **Progress** above). Every video Tool passes it.
- A new setting is a new field of `RemakeSettings`.

## Notes on the Ready row

A Tool may add its own lines to a chosen file's Ready row, before start, such as how big
the result will be. Export `readyNote` (the `ReadyNote` type in `types.ts`) from
`ready.ts` in the Tool's folder. It gets the file and the options, and is asked again
whenever the options change. It runs on the page, so keep it light: no big libraries. A
line marked `warning` is shown in the problem colour. Put its words in the
declaration's `notes`.

For a video, `videoFacts(file)` in `src/video/facts.ts` reads its shown size and length
with the browser's own player, once per file.

## Options for each file

Most options apply to every chosen file. Some belong to one file, such as where Trim a
video starts and ends. Tools without them work as before.

- List those option names in `fileOptions`, and give their starting values in
  `defaultOptions` as usual. Each chosen file starts from those values.
- Add `FileOptions.svelte` to the Tool's folder. The shared page shows it full width on
  each file's Ready row, with three props: `file` (the chosen File), `options` (that
  file's own values) and `change(values)`, which sets some of them. Pass plain values:
  a worker Tool gets a copy.
- `run` gets one options object: the page's options, with the file's own values in place.
  A changed value counts as new work for that file only, so start runs it again.
- To stop start until the values make sense, give `optionsProblem`. Its words go in
  `reasons` or `notes`, so the banned-words scan reads them. `run` can throw the same
  reason, in case another caller skips the check.
- Once a file has run, it leaves the waiting list with its editor. To make another clip
  from the same file, choose it again.

Trim a video (`src/tools/trim-video/`) is the worked example: a preview with Start and
End, each set from where the preview is paused.

## Outside addresses

Every page carries a browser lock (a Content-Security-Policy tag, ADR-0003). It lets the
page talk only to the Site. `astro.config.ts` adds every Tool's `outsideAddresses` to its
`connect-src`, so declaring one widens the lock for **every** page.

No v1 Tool declares one, and the page tests enforce that: `tests/e2e/fixtures.ts` fails if
`connect-src` is anything other than the Site, or if any request leaves the Site. So
adding an outside address is not just filling in a field. It is a decision about the
Promise: record it in an ADR, then change those checks on purpose. Never send a visitor's
files to an outside address.

## Words on the page

Every line a visitor reads follows the wording rules (issue #13):

- About a 6th-grade level, sentences under about 15 words, one idea per line.
- Say **Choose**, never "upload". Say **Save**, never "download". Use a task verb ("Change
  to JPG"), never "convert" or "converter".
- No technical words: browser engine, WebAssembly, metadata, EXIF, codec, encode, worker,
  cache, client-side, server, MIME, error codes, "invalid".
- Always write HEIC as "iPhone photo (HEIC)".
- Sizes like "3.8 MB".

The **banned-words scan** (`src/wording.test.ts`, rules in `src/wording.ts`) checks the
shared text in `src/text.ts` and every discovered Tool's declaration text: name, blurb,
noun, start button, privacy line, "All done" message, large-file note, type label,
reasons, notes, and the `textFor` words for the default options (`declarationText` in
`types.ts`). It does **not** check words written straight into `Options.svelte`, or
`textFor` words for other options, so put option names in `notes` (or shared text) and
follow the rules by hand for the rest. Shared page text lives in `src/text.ts`; Tool text
lives in the declaration.

Options must work for phones and keyboards: every tappable thing at least 44 × 44 px
(`2.75rem`), a visible label on each control, nothing that only works on hover.

## Testing

- **`run.test.ts` (Vitest).** Call `run` with the sample file(s) and check what comes out:
  the type, the count, the details, page counts or sizes, and each `ToolFailure` reason.
  Test through `run` only. Browser-only paths (canvas, WebCodecs) may not run under
  Vitest; the page test covers those.
- **The generated page test** (`tests/e2e/tools.spec.ts`, Playwright, phone-sized WebKit
  and Chromium). Nothing to write: for every discovered Tool it checks the Tool is listed
  on the home page under its Category, then opens the page, chooses `sample.<ext>`,
  presses start and waits for Save and the "All done" message. A Tool in input mode
  `none` types `sample.txt` instead, or, with no type box, fills each field named in
  `sample.json`, then waits for the picture and saves it. Each page test also runs
  an accessibility check in both themes and fails on any request that leaves the Site.

Ports, WebKit on this machine, and slow tests: see `docs/agents/testing.md`.

## Licences

A Tool that adds a library must add it to the Site's credits page (`/credits/`, linked
from Our promise). The list lives in `src/site/credits.ts`: name, license, what it does in
plain words, and links to its code and license at the shipped version. Add the packages
the library brings in too. `src/site/credits.test.ts` fails if a library in
`package.json` is missing, or a version or license no longer matches `node_modules`.
Check the licence first: anything that would make the Site's own code change licence
needs a decision before it is added.
