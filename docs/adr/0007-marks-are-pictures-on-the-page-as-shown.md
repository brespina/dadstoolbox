# Marks are pictures, placed on the page as it is shown

Sign a PDF puts every Mark (a drawn Signature, a typed Signature, a line of words) on the page as a PNG picture that the browser paints on a canvas, embedded with pdf-lib. We chose this over writing words as PDF text with an embedded font, because one painting path handles any script with the device's own fonts and needs no font embedding (no fontkit); the cost is that a Mark's words can't be selected or searched, which is fine for a signature, a name or a date.

A Mark's place is stored as `{ page, x, y, width }`, each of `x`, `y` and `width` a fraction from 0 to 1 of the page **as it is shown** (after the page's own turn, within its visible box). A Mark has no stored height: its height always follows from its picture's shape. `run` maps the place into the PDF's own coordinates and turns the picture against the page's turn, so a Mark on a page turned by Rotate PDF pages lands upright where it was tapped.

## Consequences

- A Mark is painted at 300 dots per inch of its size on the page, with its longest side at most 2000 pixels, so it prints sharply whatever screen it was placed on.
- Painting needs the page's canvas, so the Tool runs with `worker: false`, and `run` takes the painting step as an argument so Vitest can pass a stand-in.
- Saving rewrites the whole file, which would break a digital signature already in it. So a PDF with a signature field that holds a value is refused with a plain reason, in the page editor and in `run`, through one shared check. An empty signature field is fine.
- `run` never calls pdf-lib's `getForm()` (it drops XFA data) and saves with `updateFieldAppearances: false`, so filled form fields stay exactly as they were.
