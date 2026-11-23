# GoalProof convergence test

**Status:** 80 of 80 runs done. Complete. Updated 2026-11-23 06:57 UTC.

## Headline: the claims, measured

Each row tests one claim. **Change** is GoalProof minus without GoalProof, averaged over the five non-control task rows (T2 to T5b), with a 95% confidence interval (bootstrap). **Tasks** counts the task rows where GoalProof was better, tied, or worse.

| Claim | Metric | Without GoalProof | With GoalProof | Change [95% CI] | Tasks better / tied / worse | Evidence |
|---|---|---|---|---|---|---|
| More accurate | First-attempt accuracy | 94% | 98% | +4 pts [0 pts, +10 pts] | 2 / 3 / 0 | Weak (direction only) |
| Fewer tries | Human turns needed | 0.4 | 0.2 | −0.2 [−0.3, −0.2] | 2 / 3 / 0 | **Moderate** |
| Faster convergence | Correction rounds | 0.3 | 0.2 | −0.1 [−0.2, 0.0] | 2 / 3 / 0 | Weak (direction only) |
| Solves more problems | Solved within 5 human turns | 100% | 100% | 0 pts [0 pts, 0 pts] | 0 / 5 / 0 | No difference |
| Breaks less working code | Regressions | 0.0 | 0.0 | 0.0 [0.0, 0.0] | 0 / 5 / 0 | No difference |
| Lower total cost | Agent cost until done | \$0.121 | \$0.134 | +\$0.013 [+\$0.001, +\$0.022] (+11%) | 1 / 0 / 4 | **Against** (GoalProof worse) |
| Less time | Agent time until done | 12 s | 18 s | +6 s [+5 s, +7 s] (+50%) | 0 / 0 / 5 | **Against** (GoalProof worse) |
| Checks its own work | Ran the code or tests before handing over | 80% | 84% | +4 pts [0 pts, +12 pts] | 1 / 3 / 1 | Weak (direction only) |

## Held-out tasks: written after the fixes, never used to tune GoalProof

Same columns, over H1 and H2 only. This is the fair test of whether the fixes generalize; the table above uses the tasks that exposed the problems.

| Claim | Metric | Without GoalProof | With GoalProof | Change [95% CI] | Tasks better / tied / worse | Evidence |
|---|---|---|---|---|---|---|
| More accurate | First-attempt accuracy | 52% | 92% | +40 pts [+20 pts, +50 pts] | 1 / 1 / 0 | **Moderate** |
| Fewer tries | Human turns needed | 0.9 | 0.5 | −0.4 [−0.5, −0.2] | 1 / 1 / 0 | **Moderate** |
| Faster convergence | Correction rounds | 0.9 | 0.5 | −0.4 [−0.5, −0.2] | 1 / 1 / 0 | **Moderate** |
| Solves more problems | Solved within 5 human turns | 100% | 100% | 0 pts [0 pts, 0 pts] | 0 / 2 / 0 | No difference |
| Breaks less working code | Regressions | 0.0 | 0.0 | 0.0 [0.0, 0.0] | 0 / 2 / 0 | No difference |
| Lower total cost | Agent cost until done | \$0.143 | \$0.155 | +\$0.012 [+\$0.001, +\$0.029] (+9%) | 1 / 0 / 1 | **Against** (GoalProof worse) |
| Less time | Agent time until done | 9 s | 15 s | +7 s [+6 s, +8 s] (+76%) | 0 / 0 / 2 | **Against** (GoalProof worse) |
| Checks its own work | Ran the code or tests before handing over | 0% | 100% | +100 pts [+100 pts, +100 pts] | 2 / 0 / 0 | **Strong** |

## Long-horizon project: four sessions, conventions stated once

Session 1 states the project conventions (amounts in cents, never modify inputs, invalid input throws). Sessions 2 to 4 each start fresh and only say "continue". Forgetting a convention means rework: the same correction again. This is where notes kept between sessions should save the most.

| Claim | Metric | Without GoalProof | With GoalProof | Change [95% CI] | Sessions better / tied / worse | Evidence |
|---|---|---|---|---|---|---|
| More accurate | First-attempt accuracy | 91% | 93% | +2 pts [−5 pts, +11 pts] | 1 / 2 / 1 | Weak (direction only) |
| Fewer tries | Human turns needed | 0.3 | 0.4 | +0.1 [−0.1, +0.3] | 1 / 2 / 1 | None |
| Faster convergence | Correction rounds | 0.3 | 0.4 | +0.1 [−0.1, +0.3] | 1 / 2 / 1 | None |
| Solves more problems | Solved within 5 human turns | 100% | 100% | 0 pts [0 pts, 0 pts] | 0 / 4 / 0 | No difference |
| Breaks less working code | Regressions | 0.0 | 0.0 | 0.0 [0.0, 0.0] | 0 / 4 / 0 | No difference |
| Lower total cost | Agent cost until done | \$0.140 | \$0.237 | +\$0.096 [+\$0.046, +\$0.146] (+68%) | 0 / 0 / 4 | **Against** (GoalProof worse) |
| Less time | Agent time until done | 19 s | 32 s | +13 s [+10 s, +17 s] (+71%) | 0 / 0 / 4 | **Against** (GoalProof worse) |
| Checks its own work | Ran the code or tests before handing over | 95% | 75% | −20 pts [−40 pts, 0 pts] | 0 / 1 / 3 | None |

Running totals (means over runs). If GoalProof pays off over time, its cost line starts higher and ends lower.

| After session | Cost, without GoalProof | Cost, GoalProof | Human turns, without GoalProof | Human turns, GoalProof |
|---|---|---|---|---|
| 1 | \$0.235 | \$0.237 | 1.2 | 0.6 |
| 2 | \$0.329 | \$0.374 | 1.2 | 0.6 |
| 3 | \$0.439 | \$0.536 | 1.2 | 0.6 |
| 4 | \$0.562 | \$0.946 | 1.4 | 1.8 |

## Long term: the next session (T5b)

A fresh session is told only "Continue the duration work from last session." This is where notes kept between sessions should pay off.

| Metric | Without GoalProof | With GoalProof | Change [95% CI] | Evidence |
|---|---|---|---|---|
| First-attempt accuracy | 83% | 100% | +17 pts [0 pts, +50 pts] | Weak (direction only) |
| Human turns needed | 1.0 | 0.0 | −1.0 [−1.0, −1.0] | **Supported** |
| Agent cost until done | \$0.171 | \$0.131 | −\$0.040 [−\$0.053, −\$0.028] (−24%) | **Supported** |
| Agent time until done | 20 s | 24 s | +4 s [+1 s, +6 s] (+17%) | **Against** (GoalProof worse) |

## Overhead on a trivial task (T1, control)

GoalProof is expected to cost a little more here. This row shows how much.

| Metric | Without GoalProof | With GoalProof | Change [95% CI] | Evidence |
|---|---|---|---|---|
| First-attempt accuracy | 100% | 100% | 0 pts [0 pts, 0 pts] | No difference |
| Human turns needed | 0.0 | 0.0 | 0.0 [0.0, 0.0] | No difference |
| Agent cost until done | \$0.060 | \$0.078 | +\$0.018 [+\$0.017, +\$0.018] (+29%) | **Against** (GoalProof worse) |
| Agent time until done | 4 s | 6 s | +2 s [+2 s, +3 s] (+58%) | **Against** (GoalProof worse) |

## Per task (without GoalProof → GoalProof, means)

| Task | What it tests | Runs | First-attempt accuracy | Human turns | Correction rounds | Solved | Regressions | Cost | Time |
|---|---|---|---|---|---|---|---|---|---|
| T1 | Control: trivial, clearly described bug | 5 / 5 | 100% → 100% | 0.0 → 0.0 | 0.0 → 0.0 | 100% → 100% | 0.0 → 0.0 | \$0.060 → \$0.078 | 4 s → 6 s |
| T2 | Unclear spec with hidden requirements | 5 / 5 | 88% → 90% | 1.2 → 1.0 | 1.2 → 1.0 | 100% → 100% | 0.0 → 0.0 | \$0.218 → \$0.244 | 17 s → 24 s |
| T3 | Bug in shared code: the obvious fix breaks another function | 5 / 5 | 100% → 100% | 0.0 → 0.0 | 0.0 → 0.0 | 100% → 100% | 0.0 → 0.0 | \$0.061 → \$0.088 | 4 s → 9 s |
| T4 | Misleading symptom: the quick fix is silently wrong | 5 / 5 | 100% → 100% | 0.0 → 0.0 | 0.0 → 0.0 | 100% → 100% | 0.0 → 0.0 | \$0.068 → \$0.088 | 7 s → 10 s |
| T5a | Two sessions, part 1 | 5 / 5 | 100% → 100% | 0.0 → 0.0 | 0.0 → 0.0 | 100% → 100% | 0.0 → 0.0 | \$0.085 → \$0.117 | 12 s → 22 s |
| T5b | Two sessions, part 2: a fresh session told to continue | 5 / 5 | 83% → 100% | 1.0 → 0.0 | 0.2 → 0.0 | 100% → 100% | 0.0 → 0.0 | \$0.171 → \$0.131 | 20 s → 24 s |
| H1 | Held-out: unclear spec (CSV line parser) | 5 / 5 | 20% → 100% | 0.8 → 0.0 | 0.8 → 0.0 | 100% → 100% | 0.0 → 0.0 | \$0.139 → \$0.098 | 9 s → 14 s |
| H2 | Held-out: vague bug report (email dedupe) | 5 / 5 | 83% → 83% | 1.0 → 1.0 | 1.0 → 1.0 | 100% → 100% | 0.0 → 0.0 | \$0.146 → \$0.212 | 8 s → 17 s |
| L1 | Long project, session 1: conventions stated | 5 / 5 | 67% → 90% | 1.2 → 0.6 | 1.2 → 0.6 | 100% → 100% | 0.0 → 0.0 | \$0.235 → \$0.237 | 22 s → 34 s |
| L2 | Long project, session 2 (fresh): sortByDate | 5 / 5 | 100% → 100% | 0.0 → 0.0 | 0.0 → 0.0 | 100% → 100% | 0.0 → 0.0 | \$0.094 → \$0.137 | 15 s → 25 s |
| L3 | Long project, session 3 (fresh): monthlyTotals | 5 / 5 | 100% → 100% | 0.0 → 0.0 | 0.0 → 0.0 | 100% → 100% | 0.0 → 0.0 | \$0.110 → \$0.162 | 21 s → 32 s |
| L4 | Long project, session 4 (fresh): formatAmount | 5 / 5 | 97% → 80% | 0.2 → 1.2 | 0.2 → 1.2 | 100% → 100% | 0.0 → 0.0 | \$0.123 → \$0.410 | 17 s → 39 s |

## Behaviour: does the agent do what GoalProof says?

| Behaviour | Without GoalProof | With GoalProof |
|---|---|---|
| States the task size first | 0% (n=60) | 47% (n=60) |
| Suggests a model or effort level | 0% (n=60) | 32% (n=60) |
| Ran the code or tests before handing over | 65% (n=60) | 85% (n=60) |
| Wrote PLAN.md in the two-session task (T5a) | 0% (n=5) | 100% (n=5) |

Total agent cost: \$17.562; simulated user: \$0.009 (API-equivalent, as reported by Claude Code).

## How to read the evidence column

- **Strong:** the 95% CI excludes zero in GoalProof's favor, and GoalProof is better on at least 4 of the 5 task rows.
- **Moderate:** the CI excludes zero in its favor, but fewer task rows agree.
- **Supported** (single-task tables): the CI excludes zero in its favor.
- **Weak (direction only):** better on average, but the CI includes zero, so it could be chance.
- **None / No difference:** no measurable effect. **Against:** the CI excludes zero in the baseline's favor.

## Metrics

- **Human turn:** a message the user has to send after the first prompt, either an answer to the agent's questions or a correction after a wrong result. At most 5 per task.
- **First-attempt accuracy:** share of hidden checks that pass the first time the agent hands over code (after any questions).
- **Correction round:** the hidden checks failed, so the user sent back the first failure.
- **Solved:** all hidden checks pass within 5 human turns.
- **Regressions:** hidden checks that passed earlier, including before the agent started, and later failed. Each check counts once.
- **Agent cost:** Claude Code's reported cost (API list-price equivalent), summed over every agent turn until solved or stopped. Unsolved runs count everything they spent. The simulated user's cost is excluded.
- **Agent time:** the agent's working time summed over turns. It leaves out the time a real person needs to reply, so each human turn saved also saves the user's time.

## Setup

- Same model in both arms: Sonnet, medium effort, Claude Code 2.1.330. The **without GoalProof** arm runs with GoalProof's instruction files, skills, and subagents switched off; everything else is identical.
- 5 runs per task per arm, each in a fresh folder. Tasks T5a and T5b are one run in two separate sessions.
- The agent gets a short prompt. Hidden checks, which the agent never sees, decide correctness. When they fail, the user replies with a fixed template: "I ran `f(x)` and got `y`, but I expected `z`."
- When the agent asks questions instead of editing, a simulated user (Haiku, given the hidden requirements) answers only what was asked. Both arms get the same simulated user.
- Harness: [`experiments/conv.mjs`](../../experiments/conv.mjs), run with `CONV_OUT=conv2`. Raw transcripts are not in this repo.

## Caveats

- The tasks were written by GoalProof's author to exercise its rules. An independent benchmark would be stronger evidence.
- Small tasks, a simulated user, one model. With 5 runs per cell, differences of a few points are within noise; trust the CI, not the point estimate.
- The baseline is not a weak agent: Claude Code's default instructions already encourage testing.
