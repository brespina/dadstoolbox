# Running the checks locally

CI runs the same four scripts as `.github/workflows/checks.yml`: `npm run check`, `npm run format:check`, `npm test`, `npm run test:e2e`. CI's run on a pushed branch is the final word.

## Page tests (Playwright)

- **Ports.** Each run builds this checkout and serves it on `E2E_PORT` (default 4321). If that port is taken, the run fails. When several worktrees run at once, give each its own port: `E2E_PORT=5018 npm run test:e2e`.
- **WebKit.** WebKit's system libraries don't install on this Arch-based machine. To test it locally, run `npm run test:e2e:webkit` (Playwright's Docker image; your account needs Docker access). For Chromium only, run `npx playwright test --project chromium-phone`. Otherwise CI covers WebKit.
- **HEIC tests are slow.** The iPhone photo (HEIC) page tests in `change-image-type` and `make-photo-smaller` can time out on a busy machine. Rerun once before debugging; if CI passes, treat it as load.
- **Matching text.** After the first Choose, the button reads "Choose more {noun}". Row reasons also appear in the live region. Match with `{ exact: true }`.

## Unit tests (Vitest)

Vitest runs in Node, so canvas, WebCodecs and Workers are missing there. Test those paths in page tests.
