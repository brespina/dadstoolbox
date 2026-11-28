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

These steps are for a Tool that makes something to save. A Practice Tool, where the
visitor practises on the page, is built differently: see [Practice Tools](#practice-tools).

1. **Copy the template.** Copy `src/tools/_template/` to `src/tools/<address>/`, where
   `<address>` is the Tool's address in plain words, such as `change-image-type`. Drop the
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
| `name`             | The Tool's name, written as a task: "Split a PDF", "Change image file type". The page heading and home page row.                                                                                                                                                                                   |
| `blurb`            | One line in everyday words that names the visitor's problem: "iPhone photo won't open or upload?".                                                                                                                                                                                                 |
| `category`         | One of the fixed Categories, in order: `Photos`, `PDFs`, `Video`, `Practice`, `Other`.                                                                                                                                                                                                                      |
| `position`         | Order within the Category, lowest first. Keep it unique within the Category.                                                                                                                                                                                                                       |
| `noun`             | What the Tool takes, as `{ one, many }`, such as `{ one: 'PDF', many: 'PDFs' }`. Used in the privacy line, the Choose button ("Choose PDFs") and Batch labels ("3 PDFs").                                                                                                                         |
| `accept`           | File types for the Choose button: types such as `application/pdf` and endings such as `.pdf`. List both, because phones are not consistent.                                                                                                                                                        |
| `input`            | The input mode: `each`, `together` or `none`. See [Input modes](#input-modes). (`practice` is set by `definePracticeTool`; see [Practice Tools](#practice-tools).)                                                                                                                                                                                                                     |
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

- **`each`, each file on its own** (Split a PDF, Change image file type). `run` is called
  once per file, with that file and the options. Each file has its own row, so one file
  that fails doesn't stop the others.
- **`together`, all files together** (Combine PDFs). `run` is called once with the
  ordered list of every waiting file. The waiting list gets ↑ / ↓ buttons to set the
  order. Results are named after `combined` instead of an original, as in
  `combined_dtb.pdf`.
- **`none`, no file** (Make a QR code). The visitor types instead, and `run` gets the
  typed text. There is no Choose or start button: the result updates as the visitor types
  or changes the options, and is saved like any other result. Leave `accept` empty and
  write the privacy line about what they type.

  A Tool whose options hold all the input (Make a Wi-Fi QR code: a network name and a
  password) sets `typeBox: false`. The page hides the type box, `run` gets `""` as the
  typed text and reads everything from the options, and the result is made again
  whenever the options change. `run` returns `[]` while there is nothing to make yet,
  such as an empty network name: the page then shows no result and no reason. Give
  `textFor` a `pictureLabel`, so the picture is described from the options, without
  anything private such as a password.
- **`practice`, a Practice Tool** (Typing test, Vim practice). No file, no `run` and
  nothing to save: the Tool's own `Practice.svelte` is the page. `definePracticeTool`
  sets this mode; see [Practice Tools](#practice-tools).

  A typed Tool's options may hold a file the visitor chooses, such as the logo in a QR
  code's Style. `Options.svelte` puts the `File` in the options (start it as `null` in
  `defaultOptions`), and `run` gets that `File` as it is: options are copied with
  `$state.snapshot`, which keeps a file a file, and are never turned into text. The file
  stays in the page's memory. Never store it (no `localStorage`) or send it anywhere,
  and test a file that won't open, with a plain reason. This is for input mode `none`
  only: for `each` and `together`, options are compared as text to tell new work from
  old, and a file shows as `{}` there.

The template uses `each`. Each mode has its own `run` type in `types.ts`: `ToolRun`
(`each`), `ToolRunTogether` (`together`) and `ToolTextRun` (`none`). Combine PDFs and
Make a QR code are the worked examples for `together` and `none`, and Make a Wi-Fi QR code
for `none` with no type box.

The QR code Tools share their drawing and their Style (see the glossary). `drawQr` in
`src/qr/draw.ts` takes the text and a `QrStyle` (`src/qr/style.ts`) and gives the PNG (or the SVG,
when `saveAs` is `svg`) and its warnings, ready to return from `run`. Each Tool keeps its Style in
`options.style`, starting from `plainStyle` (black on white), and shows the shared
`StyleSection.svelte` from `src/qr/` in its options. A new Style choice is a new field
of `QrStyle`, drawn in `drawQr` and offered in `StyleSection.svelte`, so both Tools get
it at once. The shapes themselves are plain geometry in `src/qr/shapes.ts` (`codeParts` gives
rounded squares and rings in module units, with no pixels or colours), so the PNG and the
SVG draw the same shapes. `drawQr` rasterises them with smooth edges; `src/qr/svg.ts` writes
them as one vector path. A logo (`style.logo`, a `File`) sits on a patch with no dots
(`logoPlace` in `shapes.ts`), and the code then uses the strongest error correction (H).
Its pixels come from the browser's canvas (`src/qr/paint-logo.ts`); `drawQr` takes that
step as its third argument, so tests pass a stand-in.

## Practice Tools

A **Practice Tool** (see the glossary) lets the visitor practise a skill on the page,
such as the Typing test. It makes nothing to save, so it has no `run`, options component
or sample file ([ADR-0005](adr/0005-practice-tools-are-their-own-page.md)). Its folder
holds these two files, plus its own plain TypeScript, any smaller Svelte parts its page
uses (the Typing test's `SettingsBar.svelte`, for one) and tests:

| File               | What it holds                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `declaration.ts`   | The declaration, made with `definePracticeTool` (plain data, as for every Tool): `address`, `name`, `blurb`, `category` (usually `Practice`), `position`, `privacyLine`, `areaLabel`, `notes`, and optionally `needs`.                   |
| `Practice.svelte`  | The whole interactive page, shown under the shared back link, heading, blurb and privacy line. It takes no props: it imports its own declaration.                                                                                     |

Add the thin page at `src/pages/<address>.astro` as for any Tool. The input mode is
`practice`; `definePracticeTool` sets it and leaves the fields for files and results
(noun, accept, start button and the rest) empty. The run loader skips the Tool, and the
Tool layout shows its `Practice.svelte` through `src/components/PracticeToolPage.svelte`.

- **`areaLabel`** names the practice area, the part that takes the visitor's key
  presses. Give that element this label (`aria-label`); the generated page test finds the
  area by it and checks it takes focus.
- **`notes`** holds every word the page shows, by key, so the banned-words scan reads
  them. `definePracticeTool` keeps the keys' types, so `tool.notes.restart` is checked.
- **Logic in plain TypeScript.** Keep what the Tool does (the words, the key presses, the
  score) in pure modules next to the page, tested with Vitest, and keep the page to
  turning events into calls and showing the state.
- **Random, but repeatable.** Draw with `pageRandom(location.search)` from
  `src/practice/random.ts`: it is seeded by `?seed=<number>` in the page's address, so a
  page test can type known words, and different every visit otherwise. `seededRandom`
  gives the same source to a Vitest or page test.
- **Settings.** `src/practice/ChoiceGroup.svelte` is one labelled row of choices (radio
  buttons, at least 44 × 44 px), for a settings bar. `src/practice/Switch.svelte` is one
  on/off setting (a checkbox, same size and look) beside it.
- **Keys.** `src/practice/keys.ts` holds the rules both practice pages share:
  `isShortcut(event)` (Ctrl, Cmd or Alt shortcuts stay the browser's, but AltGr and a
  Mac's Option typing a character count as typing), `startsPractice(event)` for "Click
  or press any key to start" (a printable key pressed anywhere else on the page focuses
  the area, unless it is typed into a box), and `watchTouchOnly(set)`, which tells the
  page whether the device has no mouse or trackpad (`(any-pointer: fine)` doesn't
  match), the nearest sign of no keyboard. The Typing test hides its Layout option
  then; Vim practice keeps its area but says it needs a keyboard.
- **The start hint, results and restart.** `src/practice/StartHint.svelte` is the "Click
  or press any key to start" line over an unfocused area, `Headline.svelte` the big
  numbers at the top of the results, and `Restart.svelte` the button under the area with
  the "Or press Tab, then Enter." hint. Their words are in `text.practice`
  (`src/text.ts`).
- **Fixed-width text.** Use the `--mono` token from `src/styles/base.css`, the device's own
  fixed-width font.
- **The Promise.** Keep nothing: no `localStorage`, no personal bests. Make no outside
  requests.
- **Motion.** The Site turns transitions and animations off under reduced motion
  (`base.css`), and every page test runs with reduced motion, so a check never sees a
  fade halfway. Something that fades away while the visitor types, such as the Typing
  test's settings bar, fades all the way (opacity 0), stays reachable with Tab and shows
  again on focus.

### The Typing test

`src/tools/typing-test/` is the worked example. Its parts, for the work that builds on it:

- `words.ts`: our own list of about 200 common words (`commonWords`), and `wordStream(random,
  options)`, which gives the next words on each call. A Time test asks for more as it goes.
  `WordOptions` holds the Punctuation and Numbers switches: Punctuation capitalises after a
  full stop and adds commas, full stops, question marks, apostrophes and quotes (a quote
  closes within the same call); Numbers swaps in numbers of 1 to 4 digits. A seed gives
  the same base words whatever is on.
- `typing.ts`: the test as a pure reducer. `press(test, key)` takes one `KeyPress`: a
  `char` with the character already worked out (a space moves on), `backspace`,
  `clearWord` or `tick` (time passing), each with a time in milliseconds. The page
  maps the physical key to its character (see `layouts.ts`) before calling `press`. `score(test)` gives wpm,
  raw wpm, accuracy and the letters right, wrong, extra and missed. The test keeps every
  character key press with its time (`presses`) and when each word was finished
  (`wordEnds`), which is enough to work out the speed at each second for the chart.
  `rightWordCharacters(test, until?)` counts the characters of the words typed right
  (with their spaces) finished by a time: what counts toward wpm.
  `wordLetters` gives each letter of a word as it shows.
- `layouts.ts` and `Keyboard.svelte`: the Layouts. `resolve(layout, code, shift)` turns a
  physical key (`KeyboardEvent.code`) and Shift into the character that Layout types there
  (null for a key it leaves alone, or for "As my keyboard types"); `locate(layout, char)` is the
  reverse, which the keyboard picture uses to light the next key. The picture is
  `aria-hidden`. The Layout option shows only where `watchTouchOnly` finds a mouse or
  trackpad, so a touch-only device never sees it.
- `samples.ts` and `WpmChart.svelte`: `samples(test)` gives the wpm and raw wpm at each
  second of a finished test (and at the end, if that falls between seconds), as `{ second,
  wpm, raw }`. `WpmChart` draws them as inline SVG in the Site's tokens, with a text
  alternative and a table of the numbers, and draws nothing for under two samples.
- `settings.ts` and `SettingsBar.svelte`: the settings bar. A new setting is a new field
  of `TypingSettings` and a new `ChoiceGroup` or `Switch` in the bar; a changed setting (any field)
  starts a new test.
- `Practice.svelte`: the page. Key presses land on an unseen text box over the words, so
  a phone opens its keyboard there. A key with a known character is read on keydown; a
  phone keyboard that names no key is read from the text it would type.

### Vim practice

`src/tools/vim-practice/` holds the second Practice Tool. Its parts, for the work that adds
motions and Lessons:

- `vim.ts`: the engine. `motions` is a table of every motion, keyed by the keys that type
  it (`w`, or `gg` for two keys). Each `Motion` says what a count does (`repeat`: the
  motion runs that many times, stopping where it can go no further; `own`: `move` reads
  the count; `none`: the count is dropped) and has `move(text, cursor, count?)`, which
  returns the cursor unchanged when it can't move. The cursor keeps the column j and k
  want (`want`, `Infinity` after `$`) and the last find (`lastFind`, which `;` and `,`
  repeat); a motion that changes the cursor spreads the old one, so such a field carries
  over. `feed(text, state, key, allowed)` takes one key as `KeyboardEvent.key`: digits
  make a count (a `0` with no count is the `0` motion), Escape drops it, and a key that
  isn't in `allowed` is ignored. A motion typed with several keys (`gg`) waits: `feed`
  returns the outcome `pending` and keeps the keys so far in `VimState.keys`, and any key
  that no allowed motion continues is ignored. A motion with `takesChar` (f, F, t, T)
  takes the next single character as its last argument, whatever it is. `repeatsFind`
  marks the motions that read `lastFind` (`;` and `,`).
  `{` and `}` follow Vim's `findpar` and `%` its `findmatchlimit`, for the texts the
  Lessons use: a paragraph boundary is an empty line (a line of spaces is not one); `}`
  onto the last line lands on its last character, even from that line; a count that runs
  out of paragraphs before its last step fails, and any failed `{` or `}` still makes the
  cursor's own column the one wanted. `%` jumps from the bracket under the cursor, or the
  next one on the line, to its match among brackets of the same kind; with a
  count it is Vim's `N%` instead, N percent down the text at the first non-blank, which
  the search doesn't try because `G` is never more keys (`round.test.ts` checks that).
  Vim also treats a line starting with `.` or a form feed as
  a paragraph boundary, skips brackets in double quotes, comments and after a backslash,
  and reads `#` lines: Lessons 6 and 7 keep their texts free of all of these, and
  `round.test.ts` checks that.
- `fewest.ts`: `fewestKeys(text, cursor, allowed)` searches outward by key presses with
  the engine's own motions and gives the fewest keys to every place within 6 presses (a
  count's digits included, Shift not counted). It tells cursors apart by place, wanted
  column and last find: a cursor field added later goes into its `cursorKey` too. A
  `takesChar` motion is tried with each character on the cursor's line and costs a key
  more. To stay fast it keeps the last find only for a `repeatsFind` motion typed right
  after a find (any other motion forgets it), which gives the same fewest keys.
  `fewest.test.ts` types every short key sequence through `feed` and compares the two. To
  check the engine against real Vim (9.1 with `-N -u NONE`), run random key sequences
  through both; Vim's `:normal` stops at the first failed motion, so type each motion
  as its own `:normal!`.
- `lessons.ts`: the Lessons as data. Each lists the motions it `adds` and its own
  `texts`; `lessonMotions(i)` allows a Lesson's motions and every earlier one's. The radio
  button's name is the motions it adds, or its `label` (Mixed, the last Lesson, adds none
  and so has one: it allows every motion, on longer texts). The rules for texts are at the
  top of the file and checked in `round.test.ts`, which also checks every character of
  every text can be reached.
- `round.ts`: a round of 10 Drills (`newRound`, `press`, `results`). A Drill's target is
  drawn among places the Lesson's motions reach in 2 keys or more, preferring places
  where the Lesson's own motions save keys over the earlier Lessons' (a Lesson that adds
  none skips that second search). A round of Mixed, with every motion, draws in about
  0.15 s on a laptop; `round.test.ts` guards it. A new motion with state of its own must
  follow the search's rule for `lastFind`, or Mixed gets slow.

## The `run` contract

`run` takes the input (one file, the ordered list of files, or typed text, by input mode)
and the options. It returns a list of results:

```ts
{ blob: Blob; detail?: string; warnings?: readonly string[] }
```

- **`blob`** is the result's bytes. Its type, such as `application/pdf`, sets the file
  extension. Shared code knows the types in `extensions` in `src/tools/running.ts`; any
  other type keeps the original file's extension, or gets none for a typed Tool, which
  has no original file.
- **`detail`** is added to the name, as in `report_dtb_page3.pdf`. Shared code builds
  every name as `<original>_dtb[_<detail>].<ext>` and adds `_2`, `_3` for repeats, so a
  result never overwrites an original. Don't build names in `run`.
- **`warnings`**, for input mode `none` only, are notes shown under the result picture
  and read out when they change, such as "These colours may not scan." They never stop
  the result. Write them in shared text or the declaration's `notes`, so the
  banned-words scan reads them. Other input modes ignore them.
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
page, so those Tools set `worker: false`. For a picture that may also be an SVG, open it
with `openPicture` (`src/photos/picture.ts`): it opens a photo through `openPhoto` and an
SVG at the size `sizeSvg` works out. To draw one whole and centred on a see-through
square, use `drawInSquare` there, as Change image file type's ICO and the QR codes' logo do.

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
  each file's Ready row, with the props in `FileOptionsProps` (`types.ts`): `file` (the
  chosen File), `options` (that file's own values), `change(values)`, which sets some of
  them, and `pageOptions`, a read-only copy of the page's options, given again whenever
  they change (Sign a PDF shows the Signature with it). An editor that doesn't need
  `pageOptions` leaves it out. Pass plain values: a worker Tool gets a copy.
- Every Tool page imports every `FileOptions.svelte` (and what it imports) with the
  page, so keep it small: load a big library inside it with a dynamic `import()`, and
  show "Getting ready…" (`text.tool.gettingReady`) yourself while it loads, as Sign a
  PDF does.
- `run` gets one options object: the page's options, with the file's own values in place.
  A changed value counts as new work for that file only, so start runs it again.
- To stop start until the values make sense, give `optionsProblem`. Its words go in
  `reasons` or `notes`, so the banned-words scan reads them. `run` can throw the same
  reason, in case another caller skips the check.
- Once a file has run, it leaves the waiting list with its editor. To make another clip
  from the same file, choose it again.

Trim a video (`src/tools/trim-video/`) is the worked example: a preview with Start and
End, each set from where the preview is paused.

## Sign a PDF

Sign a PDF (`src/tools/sign-pdf/`) is a Tool in input mode `each` whose Ready row shows the
PDF's pages ([ADR-0006](adr/0006-pdf-pages-are-shown-with-pdfjs.md),
[ADR-0007](adr/0007-marks-are-pictures-on-the-page-as-shown.md)). Its parts, for the work
that builds on it:

- **The options.** The Signature (see the glossary) and the ink are page options, set by
  the pad in `Options.svelte`: drawn strokes are lists of `[x, y]` points as fractions of
  the pad, whose shape is `padShape`. The Marks are the file option `marks`, set by the page
  editor in `FileOptions.svelte`. Everything is plain data and nothing is stored.
- **The Mark** (`declaration.ts`) is `{ kind, page, x, y, width }`: `page` counts from 1,
  and `x`, `y` (its top-left corner, `y` down from the top) and `width` are fractions of the
  page as shown. It has no stored height: its height always follows from its picture's
  shape.
- **Moving and resizing Marks** (`marks.ts`). The rules are plain functions, unit-tested in
  `marks.test.ts`: `nudge` (arrow keys: 1% of the page, 10% with Shift), `resize` (Smaller
  and Bigger: a tenth, about the centre, from `smallest` to the page's width), `dragTo`,
  `placeCentred` (a tap) and `placeLowerMiddle` ("Add to page"), and `actionFor`, which turns
  a key press into an action (or nothing, so shortcuts stay the browser's). Each takes a
  `Fit`, the picture's shape and the page's shape, because a Mark's height is never stored;
  every result is kept inside the page. They change only `x`, `y` and `width`.
  `PlacedMark.svelte` is a Mark on its page for any kind: a focusable button that drags by
  pointer (with `touch-action: none` on Marks only, so a finger elsewhere still scrolls the
  pages) and takes the keys, and draws the kind's picture from its `children`.
  `MarkControls.svelte` is the chosen Mark's Smaller, Bigger and Remove buttons, and
  takes a kind's own controls as `children`. A new kind (#112 adds Text) adds its name to
  `notes` and `kindNames`, its choice to the Add choice, its starting width to
  `startingWidth`, its picture to the `PlacedMark` in `FileOptions.svelte`, and its own
  shape to `fitOf` there (today every Mark has the Signature's shape). When a picture's
  shape changes after its Marks were placed, the editor and `run` fit them back inside
  the page with `keepInside`.
- **The painter seam** (`paint.ts`). `PaintMark` gives a Mark's picture from the Mark and
  the page's options: its `shape` (width ÷ height) and `paint(width, height)`, a
  see-through PNG. `run` (`makeRun(paint)`) works out the place and paints at 300 dots an
  inch of the Mark's size on the page, longest side at most 2000 pixels; the editor uses
  the same painter to show the Mark. `paintOnCanvas` is the browser's own painting, so the
  Tool runs with `worker: false`; `run.test.ts` passes a stand-in. `pictures-on.ts` reads
  back where a saved PDF's pictures landed, for tests.
- **The shared check** (`can-sign.ts`). `openToSign(bytes)` opens the PDF with pdf-lib,
  or throws a `ToolFailure` with the reason it can't be signed here: a password, or a
  signature field that holds a value (saving would break that seal; an empty signature
  field is fine). It reads the AcroForm dictionary directly, never `getForm()`. `run` and
  the editor both call it; the editor shows the reason in place of the pages. A file that
  isn't a PDF throws an ordinary error, so it gets the shared fallback.
- **Page geometry** (`page-geometry.ts`). Pure: `placeOnPage(page, mark, shape)` maps a
  Mark's fractions of the page as shown to the PDF's own points (the picture's lower-left
  corner, its size and its turn), from the page's raw MediaBox, CropBox and `/Rotate`, the
  way pdf.js works out the visible box and turn. Only `run` uses it. `run.test.ts` checks
  where the pictures land on turned and cropped pages with `pictures-on.ts`.
- **Saving.** `run` draws each Mark on its page and saves with
  `updateFieldAppearances: false`. It never calls `getForm()`.
- **The page viewer** (`viewer.ts`) is pdf.js's **legacy** build: the modern build calls
  the newest JavaScript (such as `Map.prototype.getOrInsertComputed` and `Math.sumPrecise`)
  that iPhone Safari lacks. Only the editor imports it, with a dynamic `import()`. It runs
  the shared check, then opens the PDF with `useWasm: false` and draws pages with
  annotation mode "enable storage", at a pixel ratio of at most 2. Its worker is bundled;
  the files it asks for by name (CMaps and the plain-script picture decoders) are served
  from `pdfjs/<version>/` by `src/site/pdfjs-files.ts`. The standard fonts are left out, so
  the device's own fonts stand in for a font a PDF names but doesn't hold.

## Options that follow the chosen files

For a Tool that takes files (`each` or `together`), the page gives `Options.svelte` a
second prop, `fileTypes`: the types of the chosen files that are waiting to start, such as
`image/jpeg`, as a read-only list. It is empty before anything is chosen, and again once
a Batch has taken the files. Declare the props with `OptionsProps` from `types.ts`:

```svelte
let {
  options = $bindable(),
  fileTypes = [],
}: OptionsProps<Options> = $props();
```

`fileTypeOf` (`src/tools/file-type.ts`) makes each type: the browser's own, or, when it
gives none (some iPhone photos (HEIC)), the one the file's ending says. A Tool that
doesn't need it ignores the prop. Change image file type
(`src/tools/change-image-type/`) is the worked example: it leaves out a type every chosen
image already is, and moves the choice to the first type still offered.

## Outside addresses

Every page carries a browser lock (a Content-Security-Policy tag, ADR-0003). It lets the
page talk only to the Site. `astro.config.ts` adds every Tool's `outsideAddresses` to its
`connect-src`, so declaring one widens the lock for **every** page.

No v1 Tool declares one, and the page tests enforce that: `tests/e2e/fixtures.ts` fails if
`connect-src` is anything other than the Site, or if any request leaves the Site. So
adding an outside address is not just filling in a field. It is a decision about the
Promise: record it in an ADR, then change those checks on purpose. Never send a visitor's
files to an outside address.

## Run Python

Run Python (`src/tools/run-python/`) is a Practice Tool
([ADR-0012](adr/0012-run-python-is-a-practice-tool.md)) that runs a visitor's own Python
with Pyodide ([ADR-0008](adr/0008-python-runs-in-the-browser-with-pyodide.md)). Its pieces:

| File                            | What it holds                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `declaration.ts`                | Plain data, as for any Tool. Every word the page shows is in `notes`, including the starter Program.                                                                           |
| `Practice.svelte`               | A small shell: `PracticeToolPage.svelte` loads every Practice page into every Practice Tool's page, so the shell loads `RunPython.svelte` with `import()` once the page opens. |
| `RunPython.svelte`              | The page: editor, Run button, Console. It owns the Program text and turns the runner's state into buttons and words.                                                           |
| `ProgramEditor.svelte`          | **The editor seam.** `value` in, `onchange(value)` out, `focus()`, named by `areaLabel`. CodeMirror (#130) replaces the inside of this file only.                          |
| `Console.svelte`                | Draws the Console: a labelled live region (`role="log"`), text only (never HTML). Error runs get a bar and a hidden "Error:" for screen readers.                              |
| `console-buffer.ts`             | Pure. The lines, partial lines, the 5,000-line cap and the one "older lines removed" note. Tested with Vitest.                                                                  |
| `messages.ts`                   | **The message protocol** between page and worker, and `parseToWorker` / `parseFromWorker`, which let in nothing else.                                                          |
| `runner.ts`                     | **The page's side of a Run.** States `gettingReady`, `ready`, `running`, `failed`; takes the worker (`makeWorker`) and a `ConsoleSink` as arguments, so Vitest passes fakes. |
| `python-worker.ts`              | The worker. Loads Pyodide by the absolute address the page sends, runs each Program in a fresh namespace, and streams output as `out` messages.                               |
| `helper.py`                     | **The Python helper**, loaded with `?raw` and run once by the worker. `run_program(source)` compiles the Program as `main.py`, runs it in a fresh namespace, catches the error and prints the traceback from the Program's own first frame (the page's frames cut). It returns `ok`, `error` or `missingModule`. `helper.test.ts` runs it under Node with the same `pyodide` package. |
| `files.ts`                      | The pinned Pyodide version and the Site folder its files are served from (`files.test.ts` keeps it equal to the installed package).                                           |
| `src/site/pyodide-files.ts`     | Build integration, like `pdfjs-files.ts`: serves and copies the five Pyodide files to `run-python/pyodide/<version>/`. They are not committed.                                |

**What the Console says.** The worker sends `done` with an `outcome`; the runner turns it into the
page's own words (`notes.done`, `notes.onlyBuiltIn`), written to the Console with the stream
`note`, which a Program cannot send (`parseFromWorker` refuses it). "Done." follows only an
`ok` Run. A `missingModule` Run gets Python's own message, then the plain line, and no
"Done.". The worker calls the helper directly and not `runPythonAsync`, which would add
Pyodide's frames and its hint about `micropip`; the helper strips such a hint again for
`ModuleNotFoundError`, and no network is ever tried. Python's own messages are English and
are not scanned for banned words; the page's words in `notes` are.

**To extend a Run:** add a message type to `messages.ts` (with a case in its parse function
and a line in `messages.test.ts`), handle it in `python-worker.ts`, and give `runner.ts` a
method that sends it or a case in `onMessage` that turns it into a state change or a
Console call. Python's output reaches the page as `out` chunks, added to the buffer as they
come and drawn once per animation frame; `runProgram` in the worker is the one place a
Program runs.

**A Tool that runs a visitor's own program must use a blob worker** (ADR-0010). A worker
loaded from a normal address is not bound by the page's browser lock, so a Program could
send things to other sites; a worker made from a `blob:` URL inherits the lock. Here that
is `import PythonWorker from './python-worker?worker&inline'`. Keep the worker one
self-contained file: it has no address of its own, so every address it uses (`pyodide.mjs`
and the folder Pyodide loads the rest from) is absolute and sent by the page.

**The per-page lock.** Python's WebAssembly needs `'wasm-unsafe-eval'` in `script-src`. It
is added for this page only, in `src/pages/run-python.astro`, with
`Astro.csp?.insertScriptResource("'wasm-unsafe-eval'")`, which merges it into Astro's own
`script-src` (a second `script-src` directive would be ignored by the browser). Never add
it in `src/site/csp.ts`, which every page shares. `tests/e2e/run-python.spec.ts` checks
that this page has it and the home page and other Tools do not. Without it Pyodide waits
for ever and says nothing, so the runner gives up after 3 minutes and shows a reason with
a "Try again" button.

Tests: Vitest for `console-buffer`, `messages`, `runner` (with a fake worker) and `files`;
`tests/e2e/run-python.spec.ts` for the real thing, with a longer timeout because Python
takes 10 to 20 seconds to load.

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
  presses start and waits for Save and the "All done" message. For a Tool whose start
  waits on the person (its `optionsProblem` gives words for the default options, as Sign a
  PDF's does until a Mark is placed), it instead checks that start is greyed and the
  words show. A Tool in input mode
  `none` types `sample.txt` instead, or, with no type box, fills each field named in
  `sample.json`, then waits for the picture and saves it. A Practice Tool's test opens
  the page and checks the heading, the privacy line, the back link and that the area
  named by `areaLabel` takes focus; what the Tool does is tested in its own page test,
  such as `tests/e2e/typing-test.spec.ts`. Each page test runs with reduced motion, runs
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
