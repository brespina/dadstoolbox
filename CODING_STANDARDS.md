# Coding standards

Read during review. These are judgement calls: the type check, Prettier, the banned-words scan (`src/wording.ts`) and the credits test already enforce the mechanical rules, so review spends its attention here. Apply every rule to the whole diff.

## Docs match the code

- Docs, the guide (`docs/adding-a-tool.md`), the glossary and comments describe code that is merged. Work that isn't built yet is named by its ticket number.
- A change to a decision in `docs/adr/` gets a dated note on that ADR, or a new ADR. The original text stays as written.
- A change to shared machinery updates the guide in the same PR.

## Words a visitor reads

- Plain words for a non-technical reader: say what happens to their file, in the Site's terms ("Choose", "Save", "photo", "iPhone photo (HEIC)").
- Use the glossary's terms (`GLOSSARY.md`) for Tool, Category, Batch, Promise.
- Keep library and format jargon off the page. The credits page is where library names belong.
- A failure reason says what went wrong and what to try, in one or two short sentences.

## Shared machinery

- One way to do each shared job: open photos with `openPhoto` (`src/photos/open.ts`), keep the Batch's statuses and names in `src/tools/batch.ts`, reuse `src/photos/` for photo options. A Tool-local copy of shared behaviour is a finding.
- A new input mode adds an overload of `createToolPage`, keeping the existing callers' types.
- A large library loads only when its Tool needs it (see "Getting ready…" in the guide), and the Tool credits it in `src/site/credits.ts`, including libraries it brings in.

## Tests

- Each Tool's `run` is tested through `run` in `run.test.ts`, with every `reasons` entry covered.
- Page behaviour comes from the generated smoke test, plus a Tool spec only for what the smoke test can't reach.
- Every acceptance criterion in the ticket has a test or a stated reason it can't have one.
