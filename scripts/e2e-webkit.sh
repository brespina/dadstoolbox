#!/usr/bin/env bash
# Runs the phone-sized WebKit page tests in Playwright's Docker image. WebKit's system
# libraries don't install on Arch-based machines, so this is the local way to test WebKit.
# Extra arguments go to `playwright test`, e.g. `npm run test:e2e:webkit -- tests/e2e/home.spec.ts`.
set -euo pipefail
version=$(node -p "require('@playwright/test/package.json').version")
exec docker run --rm --init --ipc=host --network host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e E2E_PORT="${E2E_PORT:-4321}" \
  -v "$PWD":/work -w /work \
  "mcr.microsoft.com/playwright:v${version}-noble" \
  npx playwright test --project=webkit-phone "$@"
