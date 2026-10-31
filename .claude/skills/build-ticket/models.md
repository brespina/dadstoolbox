# Models

Which model and effort each subagent gets, and the evidence behind each choice. This table is living: duels and rescues change it, and every change cites the log rows behind it.

## Table

Pass the Model and Effort below as the Agent tool's `model` and `effort`.

| Role | Model | Effort | Evidence |
|---|---|---|---|
| Implementer, **pattern** ticket | sonnet | high | Starting guess |
| Implementer, **foundation** ticket | opus | high | Starting guess |
| Implementer, **hand-drawn** ticket | opus | high | Starting guess |
| Exploration (notes folder) | sonnet | medium | Starting guess |
| Quick lookup (find a file or fact) | haiku | low | Starting guess |
| Reviewer, one PR | sonnet | high | Starting guess |
| Reviewer, whole branch | opus | high | Starting guess |
| Duel judge | opus | high | Fixed: the judge is the measuring stick, so it never duels |

The lead is the user's session. Suggest Opus at medium effort, and high for grilling and spec writing.

### Ticket kinds

Give each ticket one kind when you spawn its implementer. A ticket that fits several takes the strongest model among them.

- **pattern**: copies a shape the code already has (another Tool, an existing option), or writes a small, well-documented file format.
- **foundation**: sets up shared code or a Tool-contract change that later tickets build on, so a weak choice spreads.
- **hand-drawn**: hand-written pixel, geometry or media code, where a mistake is subtle and tests catch it late.

## Duels

A duel builds one ticket twice, once per arm, to answer an open question below. Run at most two duels per spec: each doubles that ticket's cost.

1. Pick a ticket whose row has an open question. Toss a coin for which arm is **A** and which is **B**, and note it only in the log.
2. Spawn both implementers from [`implementer.md`](implementer.md), each with its arm's model and effort, its letter in the branch name (`ticket/{N}-{slug}-a`), its own `E2E_PORT` (5000 + ticket number, and 5500 + ticket number for B), and the line: "This is a duel: push your branch and report, but don't open a PR."
3. When both report, spawn a judge from [`judge.md`](judge.md). It sees the branches only as A and B.
4. Open the winner's PR yourself and carry on from step 5 of the skill. Delete the loser's branch.
5. Add a row to the log.

A tie goes to the cheaper arm: the question is whether the cheaper model is enough.

## Changing the table

- **Downgrade** a row after the cheaper arm wins or ties two duels on it.
- **Upgrade** a row after its model loses a duel by 2 or more points of the judge's total, or fails an acceptance criterion the other arm met.
- **Rescue**: when an implementer fails the checks twice or misreads its ticket, resume the ticket on the next model up (haiku → sonnet → opus). Log it. Two rescues on one row upgrade it.
- Every change to the table goes through a PR and cites its log rows in the Evidence column.

## Open questions

- Is haiku at high effort enough for **pattern** tickets? (Duel: sonnet high against haiku high.)
- Is sonnet at high effort enough for **hand-drawn** tickets? (Duel: opus high against sonnet high.)
- Is opus at medium effort a better one-PR reviewer than sonnet at high? Not duelled yet: reviewers fix code, so a duel needs a findings-only variant.

## Log

One row per duel or rescue. Tokens, tool calls and minutes come from each subagent's task notification. Judge scores are out of 20.

| Date | Spec | Ticket | Kind | A | B | Checks green on first push (A / B) | Judge (A / B) | Tokens (A / B) | Minutes (A / B) | Winner | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
