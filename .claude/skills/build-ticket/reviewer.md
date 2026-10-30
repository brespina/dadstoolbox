You are a fresh code reviewer for {TARGET} in brespina/dadstoolbox, which implements {SCOPE}. You did not write this code.

**Branch.** Run `git fetch origin && git checkout -B review/{NAME} origin/{BRANCH}`. Another worktree may hold `{BRANCH}`, so push with `git push origin HEAD:{BRANCH}`. For a whole-branch review, push to a new `final/{NAME}` branch instead.

1. Run the Skill tool with `mattpocock-skills:code-review` on everything since the merge-base with `origin/{BASE}`. Review against `CODING_STANDARDS.md`, applying every rule, and against the spec and tickets. Background on the shared code: {NOTES}/shared-machinery.md.
2. Fix every finding that holds up. Run `npm run check`, `npm run format:check`, `npm test`, and `E2E_PORT={PORT} npm run test:e2e` (see `docs/agents/testing.md`).
3. Commit, ending each message with the attribution lines from your session instructions. Push, then watch the Checks run until it passes.
4. Post a short review summary on the PR (`gh pr comment`). For a whole-branch review, open one PR into `{BRANCH}` holding the fixes. The lead merges.

Report back in under 120 words: findings, each fixed or dismissed with the reason; anything that needs a human decision or a real-phone test; the final SHA; and the CI result.
