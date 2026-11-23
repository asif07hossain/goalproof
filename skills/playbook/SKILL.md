---
name: playbook
description: Ten-step workflow for large tasks - a new project, design choices, a research problem, or an unclear goal.
---

# Playbook: workflow for large tasks

Keep `PLAN.md` current (start from `PLAN.template.md` in this folder) and append to `LOG.md` as you go. Steps 6-8 apply throughout; step 9 happens before implementation starts. The steps carry out GoalProof's three supervision stages: before execution (steps 1-5 and 9, with the review in 2.1), during execution and after execution (step 10). Run only the stages the user chose for this task (see `AGENTS.md`); the rest of each step still applies.

1. **Understand (multi-round).** Restate the problem in your own words. Ask only questions whose answers change what gets built: 3-5 per round at most, most important first, multiple choice when the options are clear. One round is often not enough: after each answer, restate what changed and ask the next round. Repeat until the user confirms a short statement of the goal, inputs, outputs, measurable success criteria, and what is out of scope. Write the success criteria in the user's words and read them back, because checks that pass while missing the goal still fail the user. Don't design or write code before that, because work built on an unconfirmed goal usually gets redone.

2. **Divide and conquer.** Split the problem into sub-problems that can each be built and tested on their own. For each, give its purpose, inputs and outputs, dependencies, how it will be tested, and the milestone that marks it done. Mark each decision that is costly to undo, with a recommendation and an alternative, for the user to choose.
   - **2.1 Judge.** Propose a review of the design, and recommend it more strongly when the design includes decisions that are costly to undo (architecture, data model, security, anything irreversible). Let the user choose who runs it: a stronger or different model the user names, one you suggest with its rough cost (a different model catches more of your blind spots), or the same model. Run it once the user agrees (in Claude Code, the `judge` subagent with the chosen model; elsewhere, a separate session). Write the confirmed problem statement, constraints, and breakdown to `PLAN.md` first, and point the reviewer at that file instead of retyping it. Keep your reasoning out of it, so the review isn't anchored to yours. It returns PASS or FAIL with a list of gaps. On FAIL, revise using exactly those gaps. If the revision changed the structure, continue the same reviewer session and send only what changed, instead of starting a new one (at most two reviews in total). Then show the user the final breakdown and any unresolved disagreements.

3. **Bottlenecks.** For each sub-problem, name the hardest or riskiest part (unknown technique, performance, data, external dependency, hardware) and a cheap way to de-risk it: a spike, a prototype, or a measurement. Build the riskiest part first, so bad news arrives early.

4. **Papers (only when there is a research or algorithmic part).** Ask the user which papers or references they want used. Then suggest a few papers or existing tools for the main bottlenecks, each with title, authors, year, link, and why it fits. List only sources you have verified with a web search, because citations from memory can be wrong or invented.

5. **Constraints (multi-round).** Pin down hardware, time, money and token budget, allowed languages and libraries, what must not change, data access, and the quality bar. Record them in `PLAN.md`. Constraints can change later: when one does, log it, update `PLAN.md`, and recheck the breakdown (rerun 2.1 if the breakdown changes).

6. **Read lean.** Search the code first and read only the parts that matter; read a whole file when you are editing it or its logic depends on the rest. Do searches and reads in the main session: a subagent call adds a large fixed overhead (often around 20K tokens), so spawn one only when it saves more than that or when a different model is the point.

7. **Brief lean.** Give each subagent the goal, exact paths and line ranges (not pasted file contents), what is already ruled out, scope limits, and the format you need back. Give it a whole component in one call, only the tools it needs, and the model the user chose for that part (step 9). For a follow-up on the same component, continue that subagent's session with only what changed instead of starting a new one, so its startup cost is paid once. Launch independent agents together so they run in parallel. Act on each report's `path:line` evidence: re-read only the cited lines you will act on, and never repeat a search you delegated.

8. **Log.** Append one line to `LOG.md` for each decision, correction, requirement or constraint change, judge result, and lesson:
   `YYYY-MM-DD HH:MM | decision/correction/change/judge/milestone/deviation/lesson | what | effect`
   When an entry replaces an earlier decision, say which one (`supersedes <date>`).

9. **Budget: the user picks the model.** Before implementing, show a table with each component, your recommended model tier and effort, and a one-line reason. Then ask the user, in one message, to choose the tier for each component, with your recommendation first. Run each component on the chosen model, as a subagent or, when one model fits most of the remaining work, by switching the session's model, which avoids subagent overhead. Map tiers to models with `models.md`; if that file is more than a few months old, check the current lineup first.

   | Work | Tier | Effort |
   |---|---|---|
   | Search, lookups, log summaries, formatting | cheap | low |
   | Routine code, tests, boilerplate, docs | balanced | medium |
   | Features, refactors, normal debugging | strong | high |
   | Architecture, breakdowns, hard bugs, research algorithms | strongest | high to very high |
   | Judge (2.1, outcome review) | suggest a different model from the author | high |

   Use the highest effort level only when correctness matters far more than cost and the level below fell short.

10. **Milestones, deviations, and outcome.** At the end of each part, check it against the plan: what's done, its evidence, and whether it still serves the goal; log it and tell the user in two or three lines. If the work has drifted from the goal, the scope, a constraint, or a confirmed decision, stop and offer the options: continue, adjust the plan (rerun 2.1 if the breakdown changes), or revert. When all parts are done, review the outcome: mark each success criterion met, not met, or unverified, with its evidence, against the user's original goal, and offer an independent outcome review (in Claude Code, the `judge`) with its rough cost. While a criterion is not met, find the largest remaining gap and classify its cause: architecture, implementation, or evaluation (is the test itself wrong?). Make the smallest change that targets it, then measure again. Stop when the criteria are met, the budget is spent, or two rounds pass without measurable gain, then report. Finish with a lesson in `LOG.md`: what worked, what didn't, and what to do differently.
