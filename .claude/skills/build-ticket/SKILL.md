---
name: build-ticket
description: Build a spec or a set of tickets in this repo with implementer subagents, one PR per ticket into an integration branch, then ship to main. Use when running /implement-spec or /implement through subagents, or when asked to build tickets overnight or hands-off.
---

You are the **lead**. Subagents build. You keep the task graph moving and merge.

The process comes from `implement-spec`; this skill adds what this repo learned. Read the `implement-spec` SKILL.md if it isn't loaded: `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/*/skills/engineering/implement-spec/SKILL.md`.

## Steps

1. **Graph.** Read the spec and its tickets. Get the blocking edges from `gh api repos/brespina/dadstoolbox/issues/<n>/dependencies/blocked_by`. The **frontier** is every open ticket whose blockers are closed or merged.
2. **Integration branch.** Create `spec/<n>-<slug>` from `main` and push it.
3. **Notes folder.** Create a notes folder in your scratchpad. Spawn one exploration subagent to write per-ticket notes there (libraries with versions and licenses, browser facts, pitfalls). Keep a `shared-machinery.md` there, and append each implementer's report of new shared APIs to it.
4. **Implementers.** For each frontier ticket, spawn a background subagent with `isolation: "worktree"`. Its prompt is [`implementer.md`](implementer.md) with the placeholders filled in, plus a line about any parallel tickets that touch the same shared files. Give each its own `E2E_PORT` (5000 + ticket number).
5. **Review.** When an implementer reports its PR, spawn a fresh reviewer from [`reviewer.md`](reviewer.md). If the user asks to save tokens, skip this step and rely on step 7.
6. **Merge.** Turn on auto-merge: `gh pr merge <pr> --auto --merge`. GitHub merges it once `checks` passes. Add the implementer's report to `shared-machinery.md`, then spawn implementers for the new frontier.
7. **Final review.** Once every ticket is merged, spawn one fresh reviewer from [`reviewer.md`](reviewer.md) on the whole integration branch against `origin/main`, opening its fixes as one PR into the integration branch.
8. **Ship.** Open a PR from the integration branch into `main` with `Closes #<n>` for the spec and every ticket. Auto-merge it, watch the Deploy run until it finishes, then load the live pages with `curl`.
9. **Clean up.** Remove the worktrees your agents used. Leave other worktrees alone.

## Durability

- After every merge, update one status comment on the spec issue: what's merged, what's running, what's left. A usage-limit cutoff then loses nothing the next session needs.
- Implementers push work in progress (see `implementer.md`), so a stopped agent leaves a branch to resume from.

## Breaks

Agents may take a break when they finish. Give it in one message: acknowledge the agent's effort and dedication, without judging the quality of its work, because praise for quality biases its later checking. Ask it to stop its preview servers and write a few lines to a `.txt` file in a worktree of the orphan `agent-breaks` branch, without reading the other notes there. You commit and push the note.

## When `gh` fails

`gh pr create` / `gh pr merge` sometimes fail with GraphQL errors. The REST forms work:

- `gh api --method POST repos/brespina/dadstoolbox/pulls -f base=… -f head=… -f title=… -f body=…`
- `gh api --method PUT repos/brespina/dadstoolbox/pulls/<pr>/merge -f merge_method=merge`
