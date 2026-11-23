# CI and git adapter

Runs the project's checks without any agent involved, so the result doesn't depend on what an agent reports. Use it with any coding agent, or none.

## Set up a project

1. Copy the verifier into the project (two files, no dependencies, Node 18 or later):
   ```bash
   mkdir -p .goalproof
   cp <goalproof>/verify/goalproof-core.mjs <goalproof>/verify/goalproof-verify.mjs .goalproof/
   ```
2. Optional: declare the checks in `.goalproof/checks.json`. Without it, the verifier detects `npm test`, pytest, `go test`, `cargo test`, or `make test`.
   ```json
   { "checks": [ { "name": "tests", "run": "npm test" }, { "name": "types", "run": "npx tsc --noEmit" } ] }
   ```
3. Run it: `node .goalproof/goalproof-verify.mjs`. It prints each check, writes `.goalproof/evidence.json` (commands, exit codes, output, and a fingerprint of the code), and shows which success criteria in `PLAN.md` are linked to a passing check (`· check: tests` on the criterion's line).

## Before every commit

Copy [`pre-commit`](pre-commit) to `.git/hooks/pre-commit` and make it executable. A commit stops when a check fails or no checks are set up; `git commit --no-verify` skips it once.

## On every push and pull request

Copy [`goalproof.yml`](goalproof.yml) to `.github/workflows/goalproof.yml`, and adjust the install step for your language. The evidence file is kept as a build artifact.

## What has been tested

The verifier and the pre-commit hook are tested (`node --test` in the repo, plus a live commit test). The GitHub Actions workflow has not been run from this repository; it calls the same verifier command.
