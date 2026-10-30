# Adding a Tool

How to add a Tool to the Site, for a future maintainer or an agent. Words in **bold** are
from [GLOSSARY.md](../GLOSSARY.md): a **Tool** is one task, it sits in one **Category**, a
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
| `sample.<ext>`   | The file the generated page test chooses. Extra test files, such as `sample-password.pdf`, can sit beside it.                                                                       |

`src/tools/types.ts` defines the declaration and `run` types. It is the source of truth:
if this guide and that file disagree, the file wins. `src/tools/split-pdf/` is a worked
example.

## The declaration

`defineTool` fills the defaults (`privacyLine`, `allDone` and `reasons`). Every other
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
| `needs`            | Browser features `run` needs, such as `webcodecs`. They are checked when the page runs. Where one is missing, the home page row and the Tool page say "Doesn't work on this browser yet" and Choose is greyed out. Add a new feature to the `BrowserFeature` type in `types.ts` if it is missing. |
| `largeFileLimit`   | A size in bytes. A file bigger than this gets a note on its Ready row warning it may be slow or stop partway on a phone. It does not stop the file. Set it from what a phone can really handle.                                                                                                    |
| `startButton`      | Words on the start button that say what will happen: "Split into pages", "Combine PDFs".                                                                                                                                                                                                          |
| `privacyLine`      | Optional. Defaults to the Promise line with the noun swapped in: "Your PDFs stay on your device. They are never sent anywhere." A Tool with no file says something like "What you type stays on your device."                                                                                    |
| `allDone`          | Optional. Shown when a Batch finishes. Defaults to "All done."                                                                                                                                                                                                                                     |
| `reasons`          | Optional. The Tool's own plain-language failure reasons, by key. `run` throws them as `ToolFailure` (see below).                                                                                                                                                                                  |
| `worker`           | Whether `run` runs in a Web Worker. See [The worker flag](#the-worker-flag).                                                                                                                                                                                                                       |
| `outsideAddresses` | Outside origins the Tool may contact. Leave it empty. See [Outside addresses](#outside-addresses).                                                                                                                                                                                                 |
| `defaultOptions`   | The options the page starts with. Their shape is the options type for `run` and `Options.svelte` (`typeof tool.defaultOptions`).                                                                                                                                                                  |

## Input modes

- **`each`, each file on its own** (Split a PDF, Change a photo to JPG). `run` is called
  once per file, with that file and the options. Each file has its own row, so one file
  that fails doesn't stop the others.
- **`together`, all files together** (Combine PDFs). `run` is called once with the
  ordered list of every waiting file. The waiting list gets ↑ / ↓ buttons to set the
  order. Results are named after `combined` instead of an original, as in
  `combined_dtb.pdf`.
- **`none`, no file** (QR code maker). The visitor types instead, and `run` gets the
  typed text. There is no Choose or start button: the result updates as the visitor types
  and is saved like any other result. Leave `accept` empty and write the privacy line
  about what they type.

The template uses `each`. For the others, check the `run` types in `types.ts` for the
exact signature.

## The `run` contract

`run` takes the input (one file, the ordered list of files, or typed text, by input mode)
and the options. It returns a list of results:

```ts
{ blob: Blob; detail?: string }
```

- **`blob`** is the result's bytes. Its type, such as `application/pdf`, sets the file
  extension. Shared code knows the types in `extensions` in `src/tools/batch.ts`; any
  other type keeps the original file's extension.
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

**Progress.** Report progress where the job is long enough to need it, using what
`types.ts` offers for it.

**Loading.** Import libraries in `run.ts`, never in `declaration.ts`. A small library can
load with the page. A big one (such as a video library or a fallback photo decoder)
should load only once a file is chosen, with a dynamic `import()` inside `run`; the page
shows "Getting ready…" meanwhile. Bundle every library and file from npm or the Site
itself. Never load anything from another site.

## The worker flag

Set `worker: true` when `run` does heavy work that would freeze the page, such as
building a gif. Shared code then runs `run` in a Web Worker through Comlink, so the page
stays responsive. In that case `run` can't use the page: no `document`, `window` or DOM
elements. `OffscreenCanvas`, `createImageBitmap` and `fetch` to the Site are fine. The
Tool doesn't make the worker itself; shared code does. Most Tools use `worker: false`.

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
noun, start button, privacy line, "All done" message and reasons. It does **not** check
words in `Options.svelte`, so follow the rules there by hand. Shared page text lives in
`src/text.ts`; Tool text lives in the declaration.

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
  presses start and waits for Save and the "All done" message. Each page test also runs
  an accessibility check in both themes and fails on any request that leaves the Site.

Run the page tests on a free port if another checkout is using 4321:
`E2E_PORT=4400 npm run test:e2e`. WebKit needs system libraries; if it won't start
locally, `npx playwright test --project chromium-phone` and let CI run WebKit.

## Licences

A Tool that adds a library must add its licence notice to the Site's credits (issue #26).
Check the licence first: anything that would make the Site's own code change licence
needs a decision before it is added.
