# A person can choose to keep their program in their own browser

Until now the Site kept nothing at all (ADR-0003; Sign a PDF deliberately keeps no Signature). Run Python is different: a program is written over many visits, and losing it when a tab closes is the first complaint anyone has. So the page offers a visible choice, always changeable: **Never keep** (the default) or **Keep my program in this browser**. We chose this over keeping always (it breaks the default Promise and shows one person's program to the next person on a shared laptop) and over keeping nothing (homework lost with a closed tab; the visitor could still Save a `.py` file).

## How

- Under Never keep, nothing is stored, **including the choice itself**: a page test checks `localStorage` is empty. Keep stores two things in `localStorage`, under keys that begin `dadstoolbox:run-python:` (the choice, and the Program's text). Choosing Never keep deletes both at once.
- A program is written to storage a moment after typing stops, not on every key.
- Storage can be missing or refuse (a private window, blocked site data, full). Then the page says plainly that it can't keep here, and the choice goes back to Never keep. It never says "kept" without a stored value to show for it.
- A stored value is checked on reading: text only, under a size cap. It is put into the editor, never run: a Program runs only when the visitor presses Run.
- The page says, beside the choice, what each option does: the program is gone when the page closes (use Save for a file), or it stays in this browser only and is never sent anywhere.

## Why `localStorage`, and the shared origin

The Site's origin, `bwandii.io`, is shared with the owner's other GitHub Pages projects, so browser storage is shared with them. A Program from a stranger could read same-origin IndexedDB from its worker (ADR-0010), but a worker has no `localStorage`, so a Program can't read what is kept here. A program is small text, which `localStorage` suits; IndexedDB would add nothing and would be reachable. The cost: another project on the origin could read or overwrite these keys. The keys are namespaced to this Tool, and a read distrusts what it finds. Clearing the browser's site data deletes it, as a visitor would expect.

## Consequences

- ADR-0003 and the Promise change in one way, and only in this way: a Tool may hold what a person chooses to Keep, in their own browser, never sent anywhere. The glossary's Promise and Practice Tool say so. The Our promise page gets one plain sentence. A dated note on ADR-0003 points here.
- The Site still has no counter, tracker or account. Nothing kept is visible to the Site's owner.
- Any other Tool that wants to keep something needs its own decision, in its own ADR. This one does not open the door for it.

Planned in spec #123 (Run Python).
