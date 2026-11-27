# Run Python is a Practice Tool, and the Practice Tool definition widens

Run Python is for someone learning Python or trying a few lines, on a page driven by typing, not by choosing files. That is what ADR-0005 made Practice Tools for: its own page component, no `run`, no Batch, nothing shared with the file Tools. So it goes in the Practice Category (position 3) as input mode `practice`, made with `definePracticeTool`. We chose this over a new Category (a fixed list, a new icon and a home page group for one Tool, which nobody learning Python would think to look under) and over Other (where a learner would not look either).

The glossary's old words for a Practice Tool were "nothing is made, saved or kept". Run Python Saves a `.py` file the person wrote and lets them Keep their Program (ADR-0011). So the definition changes: a Practice Tool has no files to choose and no results to save, and keeps nothing, except that Run Python lets a person Keep their Program. The `.py` file a person Chooses and Saves is their own writing, not a result the Tool made.

## Consequences

- Everything in ADR-0005 holds: found by its declaration, listed under its Category, its own address, the browser lock, a generated page test (the editor named by `areaLabel` takes focus).
- ADR-0005's line "a Practice Tool keeps nothing (no storage, no personal bests)" has one exception, Keep, and only Run Python takes it. A dated note on ADR-0005 points here.
- `PracticeToolPage.svelte` loads every Practice page eagerly, so Run Python's page is a small shell that loads its large parts with `import()` once opened.

Planned in spec #123 (Run Python).
