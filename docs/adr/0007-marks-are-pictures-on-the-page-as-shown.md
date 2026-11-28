# Marks are pictures, placed on the page as it is shown

Sign a PDF puts every Mark (a drawn Signature, a typed Signature, a line of words) on the page as a PNG picture that the browser paints on a canvas, embedded with pdf-lib. We chose this over writing words as PDF text with an embedded font, because one painting path handles any script with the device's own fonts and needs no font embedding (no fontkit); the cost is that a Mark's words can't be selected or searched, which is fine for a signature, a name or a date.

A Mark's place is stored as `{ page, x, y, width }`, each of `x`, `y` and `width` a fraction from 0 to 1 of the page **as it is shown** (after the page's own turn, within its visible box). A Mark has no stored height: its height always follows from its picture's shape. `run` maps the place into the PDF's own coordinates and turns the picture against the page's turn, so a Mark on a page turned by Rotate PDF pages lands upright where it was tapped.

## Consequences

- A Mark is painted at 300 dots per inch of its size on the page, with its longest side at most 2000 pixels, so it prints sharply whatever screen it was placed on.
- Painting needs the page's canvas, so the Tool runs with `worker: false`, and `run` takes the painting step as an argument so Vitest can pass a stand-in.
- Saving rewrites the whole file, which would break a digital signature already in it. So a PDF with a signature field that holds a value is refused with a plain reason, in the page editor and in `run`, through one shared check. An empty signature field is fine.
- `run` never calls pdf-lib's `getForm()` (it drops XFA data) and saves with `updateFieldAppearances: false`, so filled form fields stay exactly as they were.

Planned in spec #108 (Sign a PDF), built from #109.

## Note, 2026-11-18

The decision stands, built from #109. One detail the text left open: a Mark's `x, y` is its top-left corner, as fractions of the page as shown, with `y` measured down from the top. Built so far is the drawn Signature only: the typed Signature comes with #113 and the line of words with #112. A Mark whose picture's shape changes after it was placed (a Signature drawn after placing) is fitted back inside its page, by the editor and by `run`.

## Note, 2026-11-27

The line of words is built (#112), as the decision said: a Text Mark is `{ kind: 'text', text, page, x, y, width }`, painted in the device's own sans-serif (`system-ui`) in the ink, so any script the device can show is shown as typed. Today's date is not a kind: it is a Text Mark whose words are the device's short date (`toLocaleDateString()`) from the moment it is added. Each Mark's picture and shape follow from what it shows, so editing a Text Mark's words changes its shape; the letters keep their size, so the Mark's width follows the words and its height holds. A Text Mark with no words puts nothing on its page and counts as nothing placed.

## Note, 2026-11-27 (typed Signature and blue ink, #113)

The typed Signature is built, as the decision said: the Signature in the options is `{ kind: 'drawn', strokes }` or `{ kind: 'typed', words, font }`, whichever way the person chose last, and is painted by the same canvas path as Text, in Dancing Script (`@fontsource/dancing-script`, OFL-1.1) with the device's own sans-serif after it, so a letter the font lacks is shown as typed. The font's woff2 files (its latin, latin-ext and vietnamese letters) are bundled and served from the Site; they are added to the page with `FontFace` only once "Type it instead" is chosen, and painting waits for them. The ink is a page option, black (the default) or blue, and applies to every Mark.
