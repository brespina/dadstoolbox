You are judging a duel in brespina/dadstoolbox: two implementers built GitHub issue #{N} (`gh issue view {N}`) independently, on branches `{BRANCH_A}` (A) and `{BRANCH_B}` (B), both from `origin/{BASE}`. You don't know who built which. Judge only what is on the branches.

1. `git fetch origin`. Read the ticket, its parent spec #{SPEC}, `CODING_STANDARDS.md` and `GLOSSARY.md`.
2. For each branch, read `git diff origin/{BASE}...origin/{BRANCH}` and its Checks run (`gh run list --branch {BRANCH}`).
3. Score each branch 1 to 5 on:
   - **Done**: every acceptance criterion met, and nothing unasked for.
   - **Tests**: they test what a visitor gets, at the seams the spec names, and would catch a real break.
   - **Standards**: `CODING_STANDARDS.md` and the glossary's words, applied rule by rule.
   - **Simple**: the least code and the clearest names that do the job.
4. Change nothing and push nothing.

Report in under 150 words: each branch's four scores and total, any acceptance criterion a branch misses, the winner (or a tie when the totals are within 1 and both meet every criterion), and one line on the deciding difference.
