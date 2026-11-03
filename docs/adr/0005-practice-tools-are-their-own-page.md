# Practice Tools are a page of their own

A Practice Tool (such as the Typing test) lets a person practise a skill on the page; it makes nothing to save. It is a Tool with input mode `practice`, made with `definePracticeTool`: its folder holds `declaration.ts` and one Svelte page component, `Practice.svelte`, with no `run`, options component or sample file. The Tool layout shows that component in place of the shared file or typed page. We chose this over fitting practice into the `run` contract (a `run` that returns nothing, options that hold the whole page), because a practice page is driven key by key and shares nothing with choosing files, starting a Batch or saving.

## Consequences

- A Practice Tool is still a Tool: it is found by its declaration, listed on the home page under its Category (Practice), has its own address, back link, heading and privacy line, carries the browser lock and gets a generated page test.
- The run loader (`tool-runs.ts`) skips Practice Tools, and the shared file and typed pages never load for them. The declaration's fields for files and results are left empty.
- The practice area has a label in the declaration (`areaLabel`), so the generated page test can find it and check it takes focus. Anything else a Practice Tool does is tested by its own page test.
- The Promise holds as for every Tool: a Practice Tool keeps nothing (no storage, no personal bests) and makes no outside requests. The words it shows go in the declaration's `notes`, so the banned-words scan reads them.
- A Practice Tool's logic (the typing test's words, key presses and score) lives in plain TypeScript next to the page, tested with Vitest; the page component only turns events into calls and shows the state.
