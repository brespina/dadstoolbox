You are implementing GitHub issue #{N} in brespina/dadstoolbox (`gh issue view {N} --json number,title,body,comments`). Its parent spec is #{SPEC}.

Read first, and build on these rather than re-researching them:

- {NOTES}/shared-machinery.md: the shared code you build on.
- {NOTES}/ticket-{N}.md: library and browser notes for this ticket.
- `docs/adding-a-tool.md`, `docs/agents/testing.md`, `GLOSSARY.md`, `docs/adr/`.

**Process.** Follow `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/*/skills/engineering/implement/SKILL.md` by hand. For "tdd", use the Skill tool with `mattpocock-skills:tdd`. A separate fresh reviewer covers its code-review step.

**Branch.** Run `git fetch origin`. Start from `origin/ticket/{N}-{slug}` if it exists (a resumed ticket), otherwise from `origin/{BASE}`: `git checkout -B work/{N} <start>`, then confirm `git log -1` matches `<start>`. Another worktree may hold `ticket/{N}-{slug}`, so push only with `git push origin HEAD:ticket/{N}-{slug}`.

**Save as you go.** After each passing test cycle, commit and push your branch, so a cutoff at any moment loses little.

**Checks.** Run `npm run check`, `npm run format:check`, `npm test`, and `E2E_PORT={PORT} npm run test:e2e`. All must pass. `docs/agents/testing.md` covers WebKit on this machine and the slow tests.

**Commits.** End every commit message with the attribution lines from your session instructions.

**When done:**

1. `git fetch origin && git merge origin/{BASE}`, then rerun the checks.
2. Push, then watch the Checks run (`gh run list --branch ticket/{N}-{slug}`, then `gh run watch <id>`) until it passes.
3. Open a PR into `{BASE}` titled "<ticket title> (#{N})", with a short summary and "Part of #{N}". End the body with the PR attribution lines from your session instructions.

The lead merges the PR and closes the issue.

Report back in under 120 words: the PR URL, final SHA, CI result, and anything later tickets need (new shared APIs, gotchas, choices left open).
