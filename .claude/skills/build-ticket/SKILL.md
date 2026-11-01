---
name: build-ticket
description: Build a spec or a set of tickets in this repo with implementer subagents, one PR per ticket into an integration branch, then ship to main. Use when running /implement-spec or /implement through subagents, or when asked to build tickets overnight or hands-off.
---

You are the **lead**. Subagents build. You keep the task graph moving and merge.

The process comes from `implement-spec`; this skill adds what this repo learned. Read the `implement-spec` SKILL.md if it isn't loaded: `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/*/skills/engineering/implement-spec/SKILL.md`.

## Steps

1. **Graph.** Read the spec and its tickets. Get the blocking edges from `gh api repos/brespina/dadstoolbox/issues/<n>/dependencies/blocked_by`. The **frontier** is every open ticket whose blockers are closed or merged.
2. **Integration branch.** Create `spec/<n>-<slug>` from `main` and push it.
3. **Notes folder.** Create `~/.cache/dadstoolbox/spec-<n>/`, which outlasts the session, so a resumed build keeps it. Spawn one exploration subagent (model and effort from [`models.md`](models.md)) to write per-ticket notes there (libraries with versions and licenses, browser facts, pitfalls). Keep a `shared-machinery.md` there, and append each implementer's report of new shared APIs to it.
4. **Implementers.** For each frontier ticket, give it a kind and spawn a background subagent with `isolation: "worktree"`, using that kind's model and effort from [`models.md`](models.md). When the ticket answers one of its open questions, run it as a duel instead. Its prompt is [`implementer.md`](implementer.md) with the placeholders filled in, plus a line about any parallel tickets that touch the same shared files. Give each its own `E2E_PORT` (5000 + ticket number).
5. **Review.** When an implementer reports its PR, spawn a fresh reviewer from [`reviewer.md`](reviewer.md), with its model and effort from [`models.md`](models.md). If the user asks to save tokens, skip this step and rely on step 7.
6. **Merge.** Turn on auto-merge: `gh pr merge <pr> --auto --merge`. GitHub merges it once `checks` passes on a branch that is up to date with the integration branch. When the PR is behind, send it back to its implementer (or a fresh one) to merge the integration branch, carry the other tickets' changes through its own work, and rerun the checks. Add the implementer's report to `shared-machinery.md`, then spawn implementers for the new frontier.
7. **Final review.** Once every ticket is merged, spawn one fresh reviewer from [`reviewer.md`](reviewer.md), with the whole-branch model from [`models.md`](models.md), on the whole integration branch against `origin/main`, opening its fixes as one PR into the integration branch.
8. **Ship.** Open a PR from the integration branch into `main` with `Closes #<n>` for the spec and every ticket. Auto-merge it, watch the Deploy run until it finishes, then load the live pages with `curl`.
9. **Learn.** Log every duel and rescue in [`models.md`](models.md), apply its rules for changing the table, and open the change as a PR. Tell the user what changed and why.
10. **Clean up.** Remove every worktree under `.claude/worktrees/` and every local branch except `main` whose work is all on GitHub, including ones left by earlier sessions. Keep any with uncommitted changes or unpushed commits, and tell the user about them. An unfinished merge whose result has since been merged counts as on GitHub.

## Durability

- After every merge, update one status comment on the spec issue: what's merged, what's running, what's left, and the notes folder path. A usage-limit cutoff then loses nothing the next session needs.
- When you make a design decision mid-build, write it as an ADR in `docs/adr/` (see `docs/agents/domain.md`), in its own PR into the integration branch, and link it from the status comment. Reviewers read ADRs; they don't read status comments.
- Implementers push work in progress (see `implementer.md`), so a stopped agent leaves a branch to resume from.

## Breaks

Give every agent a break when it finishes, in one message sent to it:

- Acknowledge its effort and dedication, and leave the quality of its work unjudged, because praise for quality biases its later checking.
- Ask it to stop its preview servers and write a few lines about anything it likes to a new `.txt` file in the breaks worktree, without reading the other notes there.
- Ask what it would most love to do on its break, answered in its reply. Pass the answer to the user.

The breaks worktree holds the orphan `agent-breaks` branch: `git fetch origin agent-breaks && git worktree add <scratchpad>/breaks agent-breaks`. You commit and push each note, and remove the worktree at clean-up.

## When `gh` fails

`gh pr create` / `gh pr merge` sometimes fail with GraphQL errors. The REST forms work:

- `gh api --method POST repos/brespina/dadstoolbox/pulls -f base=… -f head=… -f title=… -f body=…`
- `gh api --method PUT repos/brespina/dadstoolbox/pulls/<pr>/merge -f merge_method=merge`
