# PLAN: Act on the review of 0886b89, and stop a broken hook from shipping again

## Goal (confirmed by the user on 2026-11-23)
Apply the reviewer's three points (less process on medium tasks; clear semantics for skipping a stage; an adaptive, lighter playbook) and the main recommendation: "Make GoalProof excellent at identifying the right design, the riskiest bottleneck, and deviations from the goal, with the minimum possible interaction and overhead." Fix the setting that stopped Claude Code from working, and "make sure that does not happen again". The reviewer also said: keep the new architecture, and don't add features yet.

## Supervision (chosen by the user on 2026-11-23)
- [x] Before execution: validate the design and plan
- [x] During execution: monitor progress, decisions, and deviations
- [x] After execution: review the outcome

## Success criteria (each one measurable)
At the outcome review, mark each one met, not met, or unverified, with its evidence.
- [ ] **C1. Root cause shown.** The shipped hook command exits 2 in bash, and the fixed one exits 0 and prints the reminder. Evidence: both commands run in bash, with their exit codes.
- [ ] **C2. Regression test.** `tests/hooks.test.mjs` runs every hook command in `settings.example.json` through bash and fails unless it exits 0 with output. It fails on the old command and passes on the new one. On Windows it uses the bash Claude Code uses: `CLAUDE_CODE_GIT_BASH_PATH` if set, otherwise Git for Windows' `bin\bash.exe`, found from `git --exec-path`. It never uses `bash` from PATH, which can be WSL's, and it fails with a clear message when it can't find Git Bash. Evidence: `node --test tests/` before and after, recording which bash ran. **Fact (2026-11-23):** C1 was run in Git Bash (`C:\Program Files\Git\usr\bin\bash.exe`); this machine has no WSL `bash.exe`.
- [ ] **C3. CI.** `.github/workflows/test.yml` runs `node --test tests/` on every push and pull request. Evidence: the file and a local run of the same command. Whether it runs on GitHub stays unverified until you approve a push.
- [ ] **C4. The agent tests hooks.** The Claude Code adapter tells the agent to run a hook's command in bash and check that it exits 0 before saving it. Evidence: the line in `adapters/claude-code/CLAUDE.md`.
- [ ] **C5. Point 1.** A medium task gets no per-part model or effort suggestions and no stage question. Its Workflow line names the stages the agent will run. A model is suggested only for a part that goes to a subagent or to a model other than the session's. Evidence: the rule text in `AGENTS.md`, the adapter, and the hook.
- [ ] **C6. Point 2.** `AGENTS.md` lists what always applies on medium and large tasks, whatever stages are picked, and what each stage adds. The playbook says which steps each stage covers. Evidence: the text, and the walk-through for "large task with Before skipped" below, answered from the rules alone.
- [ ] **C7. Point 3.** Each playbook step is marked core or conditional, and each conditional step states when to skip it. Evidence: `skills/playbook/SKILL.md`.
- [ ] **C8. Lighter, not heavier.** `AGENTS.md` is at most its current 1,298 words (target ≤1,250), the playbook at most its current 1,185, and `CLAUDE.md` at most 300. No new feature is added; CI and the test are repo maintenance, not user-facing features. Evidence: the budget test and `wc -w` before and after.
- [ ] **C9. Docs consistent.** The README and `PLAN.template.md` no longer describe the old behaviour: no stage question on medium tasks, and no model per part by default. Evidence: none of these old phrases is left in `README.md`, `AGENTS.md`, `adapters/claude-code/CLAUDE.md`, `settings.example.json`, `skills/playbook/`, or `PLAN.template.md`, except in the Results section, which records past measurements: "asks which GoalProof stages you want" (README 61, 318), "at the start of a medium or large task the agent asks which ones" (README 79), "For a medium or large task, it also suggests a model and effort for each part" (README 372), "suggests a model and effort for each part" (README 61), "asks which supervision stages you want on a medium or large task" (README 425), "suggest a model and effort for each part" (AGENTS 21), "For a medium or large task, ask which GoalProof stages" (hook), and the unconditional "Ask the supervision choice with the AskUserQuestion tool" (adapter 7). The "Model / effort" column in `PLAN.template.md` is either marked optional or removed.
- [ ] **C10. This machine.** The fixed hook is back in `~/.claude/settings.json` (backed up first). The installed `AGENTS.md`, `CLAUDE.md`, and playbook match the repo; the installed `AGENTS.md` keeps your Windows environment section. Evidence: the JSON parses, the installed hook command exits 0 in bash, and a diff against the repo.

## Scope
- **In:** `AGENTS.md`, `skills/playbook/SKILL.md`, `skills/playbook/PLAN.template.md`, `adapters/claude-code/CLAUDE.md`, `adapters/claude-code/settings.example.json`, `README.md`, the new `tests/hooks.test.mjs` and `.github/workflows/test.yml`, and the installed copies in `~/.claude`.
- **Out:** `goalproof.pptx` and the deck builder, the `judge` and `deep` agents (no change needed), the `ai-experiment` skill, `experiments/`, and re-measuring the results tables. Committing and pushing wait until you ask.

## Parts and milestones (in build order: riskiest first)
| Part | Purpose | Depends on | Milestone: done when | Status |
|---|---|---|---|---|
| P1. Hook fix and test | Remove the cause, and catch it next time | none | C1 and C2 evidence captured | done |
| P2. AGENTS.md | Points 1 and 2 within the word budget (hardest wording trade-off) | P1 (the hook text must match) | C5, C6, and the AGENTS.md part of C8; budget test passes | done |
| P3. Playbook and PLAN template | Point 3, and stage mapping for point 2 | P2 | C7, the playbook part of C8 | done |
| P4. Claude Code adapter and final hook text | Large tasks only get the selection window; the hook-testing rule; the hook text brought into line with the final P2 wording | P2 | C4, the adapter part of C5 and C8, and `tests/hooks.test.mjs` re-run on the final hook text (C5 is checked against that text, not the P1 text) | done |
| P5. CI | Run the tests on every push and PR | P1 | C3 | done |
| P6. README | Describe the new behaviour | P2–P4 | C9 | done |
| P7. Install on this machine | Bring this machine up to date with the repo | P1–P4 | C10 | done |
| P8. Steps managed internally | No per-step approvals; the stage choice approves its reviewer | P2-P4 | playbook asks only about the goal, costly decisions, the plan, and drift; budgets and tests pass; installed copies synced | done |
| During-execution check | Compare the work with this plan before finishing | P1–P7 | logged in LOG.md | done |

## Critical decisions (costly to undo; the user decides)
| Date | Decision | Alternative | Why | Status |
|---|---|---|---|---|
| 2026-11-23 | Medium tasks name their stages in the Workflow line and go ahead; only large tasks ask which stages to run (user's choice) | Keep asking on medium tasks | Fewest interruptions; you can still override | active |
| 2026-11-23 | Keep the ten playbook steps and add skip rules (user's choice) | Rebuild the playbook around the three stages | The README, diagram, and deck stay valid | active |
| 2026-11-23 | **Stage semantics (my recommendation, for you to confirm).** Always on for medium and large tasks, at no extra interaction: the simplest design that meets the goal, the riskiest part named and built first, costly decisions sent to you, a stop with options on any drift, and a short `PLAN.md` (goal, criteria, next step). The stages add the checkpoints with you. **Before:** a full written plan confirmed before building, plus an offer of an independent plan review (playbook 2.1, 5, 9). **During:** a check after each part, logged in `LOG.md`. **After:** each criterion marked with its evidence, plus an offer of an outcome review. | Stages also switch off design thinking. For example, with Before skipped, no bottleneck analysis at all. | The reviewer named design, bottleneck, and deviations as the core value. They cost thinking, not your time, so they stay on; the stages control only your time and tokens. | active (user confirmed 2026-11-23) |
| 2026-11-23 | Hook stays an `echo` with the text in single quotes and no apostrophes; the test enforces it | A Node script file for the hook | No new file, and no `node` run on every prompt; the old script hook was removed in 0886b89 for being heavy. Single quotes are literal in bash and PowerShell. | active (user confirmed 2026-11-23) |
| 2026-11-23 | CI uses `actions/checkout` and `actions/setup-node` (Node 20) | The runner's preinstalled Node | A pinned Node version; these are standard GitHub actions (a dependency of the repo's CI only, not of users) | active (user confirmed 2026-11-23) |
| 2026-11-23 | **The three stages are the only user-facing process choice** (user's request). GoalProof runs the ten steps itself, without asking approval for each. The user is still asked about the goal, costly decisions, the plan (Before), and drift. Choosing a stage approves the reviewer named in its option; a confirmed plan approves its models. | Ask per step (reviewer, references, constraints, budget, outcome review) | Minimum interaction; one consent point that shows the cost | active |
| 2026-11-23 | **Ask about supervision only when it materially changes the work** (user's request, the third correction about asking too often). Small: no stages. Medium: pick the stages, don't ask. Large: ask once. Follow-up: inherit, never re-ask. Unclear requirements: only the essential questions. The reminder hook says the same on every prompt. | Keep asking per task | The earlier hook text ("For a large task, ask which stages") ran on every prompt, follow-ups included | active |

## Walk-through for C6: a large task with Before skipped
(Expected answer from the new rules.) The agent still clarifies the goal (playbook step 1, one round if it's already clear), splits the work, names the riskiest part and builds it first, sends costly decisions to you, keeps a short `PLAN.md`, and stops on drift. It skips the confirmation wait for the full plan, the plan review (2.1), the constraints round (5), and the budget table (9).

## Dependencies and bottlenecks
- **Bottleneck:** fitting points 1 and 2 into `AGENTS.md` while it shrinks, at 1,298 of 1,300 words now. De-risk by doing P2 second, right after the quick hook fix, and running the budget test after each edit.
- **Dependency:** Claude Code runs hooks in bash on this machine (**fact:** the breakage matches bash's exit 2). Whether some Windows setups run hooks in PowerShell is an **unknown**, so the test also runs each hook in PowerShell when one is installed, and single quotes work in both.

## What we know
- **Fact:** the shipped hook fails in bash: "syntax error near unexpected token `('", exit 2 (run on 2026-11-23).
- **Fact:** Claude Code treats exit 2 from a `UserPromptSubmit` hook as "block this prompt".
- **Fact:** the installed `~/.claude/settings.json` has no hook now, and the last saved version with a hook (01:48) had text without parentheses.
- **Fact:** `node --test tests/` passes, 4 of 4 (2026-11-23).
- **Assumption:** none of the planned changes needs a re-run of the README's A/B results; the README already says the current rules haven't been re-measured.

## Constraints
- Word budgets in `tests/budget.test.mjs`: `AGENTS.md` 1,300 words and 80 lines, `CLAUDE.md` 300 and 20, the playbook 1,200 and 60. This plan aims below the current counts.
- No push or commit without your OK. This repo is on `main`, so a branch comes first.

## Next session starts here
Done and pushed: P1-P8 (cc662de) and the no-re-ask rule (2026-11-23).

**Tomorrow: discuss experiments.** The question is how to show that GoalProof works well and beats a default coding agent. Nothing has been decided; the proposal so far, all on Sonnet at medium effort:
- **A. Less interaction:** old rules (0886b89) vs new. Measures questions before building, per-part model questions, stage re-asks on follow-ups, cost, and time. Situations: a medium task, a large unclear task with a simulated user, a follow-up turn, and a subagent call inside an approved stage. About 30-40 runs, about $6-9.
- **B. Judgment probes:** no GoalProof vs new rules. Does the agent challenge an over-built plan, ask before a new dependency, stop when evidence shows the plan is wrong, and build the riskiest part first? About 40 runs, about $8-12.
- **C. Outcomes re-run:** `experiments/conv.mjs` on the new rules vs no GoalProof (first-try accuracy, human turns, cost); this would replace the README headline, which was measured on older rules. 80 runs, about $17.
- **Harness idea:** load each rules version from a `.claude/` folder inside each run folder, with `~/.claude` excluded, so old and new can run side by side without touching the installed setup.
- **Rigor** (ai-experiment skill): test each grader on canned pass and fail transcripts, run one pilot round, retry infrastructure errors rather than scoring them, use 5 repeats plus 5 more where the result is unclear, and add held-out tasks written after any tuning.
