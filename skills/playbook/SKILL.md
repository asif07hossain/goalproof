---
name: playbook
description: Ten-step workflow for large tasks - a new project, design choices, a research problem, or an unclear goal.
---

# Playbook: workflow for large tasks

Keep `PLAN.md` current (start from `PLAN.template.md` in this folder). **Core** steps (1, 2, 3, 8, 10) always run. **Conditional** steps run only when their condition holds. You manage the steps: never ask the user to approve one. The user's choices are the stages, the goal (step 1), and costly decisions. Steps 6 and 7 say how to work, not what to report. The stages the user chose (see `AGENTS.md`) add the checkpoints: **Before** adds the plan confirmation at the end of step 3, plus steps 2.1, 5, and 9; **During** adds the milestone checks in step 10; **After** adds the outcome review in step 10. Without Before, there is no plan confirmation: build right after steps 2 and 3.

1. **Understand (core).** Restate the problem in your own words. Ask only questions whose answers change what gets built: 3-5 per round at most, most important first, multiple choice when the options are clear. Ask another round only while the goal is still unclear; when the request already states the goal and criteria, one confirmation is enough. Finish when the user confirms the goal, inputs, outputs, measurable success criteria (in the user's words, read back to them), and what is out of scope. Don't design or write code before that, because work built on an unconfirmed goal usually gets redone.

2. **Divide and conquer (core).** Split the problem into sub-problems that can each be built and tested on their own, using the simplest breakdown that covers the criteria. For each, give its purpose, inputs and outputs, dependencies, how it will be tested, and the milestone that marks it done. Mark each decision that is costly to undo, with a recommendation and an alternative, for the user to choose.
   - **2.1 Judge (conditional: the Before stage included a reviewer).** Run the review on the reviewer named when the stage was chosen, without asking again (in Claude Code, the `judge` subagent on that model; elsewhere, a separate session). When you recommend the stage, suggest a model different from yours, since it catches more of your blind spots. Write the confirmed problem statement, constraints, and breakdown to `PLAN.md` first, and point the reviewer at that file; keep your reasoning out of it, so the review isn't anchored to yours. It returns PASS or FAIL with gaps. Revise using exactly those gaps. If the revision changed the structure, continue the same reviewer session with only the changes (at most two reviews in total). Then show the user the final breakdown and any unresolved disagreements.

3. **Bottlenecks (core).** For each sub-problem, name the hardest or riskiest part (unknown technique, performance, data, external dependency, hardware) and a cheap way to de-risk it: a spike, a prototype, or a measurement. Build the riskiest part first, so bad news arrives early. With the Before stage, show the user the plan now and build once they confirm it.

4. **Papers (conditional: a research or algorithmic part).** Use any references the user gave, and add a few papers or existing tools for the main bottlenecks to the plan, each with title, authors, year, link, and why it fits. List only sources you have verified with a web search, because citations from memory can be wrong or invented.

5. **Constraints (conditional: the Before stage).** Record in `PLAN.md` the constraints that shape the design (hardware, time, money and token budget, languages and libraries, what must not change, data access, the quality bar), marking unconfirmed ones as assumptions; the user checks them when confirming the plan. Ask in step 1 only about one that is unknown and would change the design. When a constraint changes later, log it, update `PLAN.md`, and recheck the breakdown (rerun 2.1 if the breakdown changes).

6. **Read lean.** Search the code first and read only the parts that matter; read a whole file when you are editing it or its logic depends on the rest. Do searches and reads in the main session, not in subagents (see `AGENTS.md`).

7. **Brief lean.** Give each subagent the goal, exact paths and line ranges (not pasted file contents), what is already ruled out, scope limits, and the format you need back. Give it a whole component in one call, only the tools it needs, and the model from the plan. For a follow-up, continue the same subagent with only what changed. Launch independent agents together so they run in parallel. Act on each report's `path:line` evidence: re-read only the cited lines you will act on, and never repeat a search you delegated.

8. **Log (core, one line each).** Append to `LOG.md` each decision, deviation, requirement or constraint change, judge result, milestone check, and lesson:
   `YYYY-MM-DD HH:MM | decision/change/judge/milestone/deviation/lesson | what | effect`
   When an entry replaces an earlier decision, say which one (`supersedes <date>`).

9. **Budget (conditional: the Before stage, and some part should run on a different model or a subagent).** Put the tier and effort for only those parts, with a one-line reason, in the plan's parts table; confirming the plan approves them, so delegate without asking again. Run each on that model, as a subagent or by switching the session's model when one model fits most of the remaining work. Map tiers to models with `models.md`; if that file is more than a few months old, check the current lineup first.

   | Work | Tier | Effort |
   |---|---|---|
   | Search, lookups, log summaries, formatting | cheap | low |
   | Routine code, tests, boilerplate, docs | balanced | medium |
   | Features, refactors, normal debugging | strong | high |
   | Architecture, breakdowns, hard bugs, research algorithms | strongest | high to very high |
   | Judge (2.1, outcome review) | suggest a different model from the author | high |

   Use the highest effort level only when correctness matters far more than cost and the level below fell short.

10. **Deviations, milestones, and outcome (core).** Always: if the work drifts from the goal, the scope, a constraint, or a confirmed decision, stop and offer the options: continue, adjust the plan (rerun 2.1 if the breakdown changes), or revert. With the During stage, check each finished part against the plan (what's done, its evidence, and whether it still serves the goal), log it, and tell the user in two or three lines. With the After stage, once all parts are done, mark each success criterion met, not met, or unverified, with its evidence, against the user's original goal, with the outcome review by the stage's reviewer, if any (in Claude Code, the `judge`). While a criterion is not met, find the largest remaining gap and classify its cause: architecture, implementation, or evaluation (is the test itself wrong?). Make the smallest change that targets it, then measure again. Stop when the criteria are met, the budget is spent, or two rounds pass without measurable gain, then report. Finish with a lesson in `LOG.md`: what worked, what didn't, and what to do differently.
