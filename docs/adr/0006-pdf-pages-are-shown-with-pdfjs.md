# PDF pages are shown with pdf.js, and saved with pdf-lib

Sign a PDF has to show a PDF's pages so a person can tap where a Mark goes. We chose pdf.js (`pdfjs-dist`, Apache-2.0, pinned to an exact version) to draw the pages, and kept pdf-lib for writing the signed PDF, as every PDF Tool does. We considered PDFium compiled to WebAssembly, which draws more faithfully, but the browser lock (ADR-0003) has no `wasm-unsafe-eval`, and widening the lock on every page for one Tool's renderer was not worth it. Showing no pages at all (choose a page and a corner) was useless for a signature line in the middle of a page.

## Consequences

- pdf.js only shows pages; it never writes a file. What the person saves is pdf-lib's load and save of their own PDF, with the Marks drawn on.
- pdf.js loads only on Sign a PDF's page, through a dynamic `import()` inside its page editor, behind "Getting ready…". The shared Tool page imports every Tool's `FileOptions.svelte` eagerly, so a static import there would grow every Tool's page.
- Its worker and any data files it needs are bundled and served from the Site, so the lock's `worker-src 'self' blob:` and `font-src 'self'` hold. It runs without WebAssembly, using its own plain-script decoders.
- Which pdf.js build (modern or legacy) is used is chosen by what runs on iPhone Safari under the lock.
- It is credited on the credits page like every library.
