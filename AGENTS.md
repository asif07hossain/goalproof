# GoalProof: core rules

These rules apply to every task and work with any coding agent that reads Markdown; tool-specific details live in adapters such as `CLAUDE.md`. GoalProof supervises design and workflow: are we doing the right work, in the right way? Whether the code works is for tests and other tools; their results are evidence here, not the goal. GoalProof is advisory: the agent suggests the strategy (workflow size, model, effort, subagents), and the user decides. Within the user's boundaries below, go ahead without asking.

## Core principles
- **Goal first:** the confirmed goal and success criteria define "done".
- **Adaptive:** apply only as much process as the task needs.
- **Simple:** prefer the simplest design that meets the goal, and challenge complexity it doesn't need.
- **Evidence-backed:** claims of progress or completion point to evidence, not confidence.
- **Self-improving:** large tasks end with a recorded lesson, and corrections that repeat become rules.

## Environment and boundaries (edit for your machine)
- OS and shells: [fill in, e.g. "macOS with zsh"]
- Installed runtimes: [fill in, e.g. "Git, Node 20, Python 3.12"]
- Paths: [fill in quirks, e.g. "paths contain spaces; quote them"]
- Ask before installing any runtime or global tool.
- Temporary files go in a scratch location, never in the repo.
- Boundaries (optional): [what needs no approval, e.g. "subagents on Sonnet or Haiku", "supervision: before and after execution"]

## Size the task first
Start the first reply to each new task with one line: the workflow size and what you suggest for the session's model (e.g. "Workflow: small · current settings are fine"); follow-ups don't repeat it. You can't change the session's model or effort, so this line is how the user decides; never switch them on your own. For a medium or large task, in the same message, suggest a model and effort for each part with a reason and ask which supervision stages to use; then wait once for the answer.
- **Small** (clear, about one file, or a question): implement, then check the result against the request.
- **Medium** (a few files and a clear goal, or work the user says will continue in a later session): ask only if something is unclear, and run the supervision stages the user chose.
- **Large** (new project, design choices, research problem, or unclear goal): follow the playbook in `skills/playbook/SKILL.md`, installed next to this file.
- **ML, LLM, agent, or data experiments** of any size: also follow `skills/ai-experiment/SKILL.md`.
- **Re-size** when evidence changes (two failed attempts, a change spreading beyond the plan, a design problem): move up a size and say so.

At any size, if the request leaves open behavior the user will rely on (accepted inputs, formats, edge cases), ask before building. If you can't ask, build the broader reading and list what you assumed, because a narrow guess costs the user a round trip for every case it misses.

## Supervising the work (medium and large tasks)
GoalProof guides and challenges the work at three stages, without micromanaging each action. Stages cost time and tokens now to save rework later, so the user picks them per task: recommend those that fit, with a reason each, unless the user's boundaries set them. Record the choice in `PLAN.md`.
1. **Before execution: validate the design and plan.** Write `PLAN.md`: the goal in the user's words, measurable success criteria, scope, parts, and milestones. Challenge the design: does it add parts, dependencies, or abstractions the goal doesn't need? Name each decision that is costly to undo (architecture, data model, new dependency, security, anything irreversible) with a recommendation, an alternative, and the trade-offs; the user decides. Order the parts by dependency, riskiest bottleneck first. Recommend an independent review (the user picks the reviewer); build only once the plan is confirmed.
2. **During execution: monitor progress, decisions, and deviations.** After each part (for a medium task, once before finishing), compare the work with the plan: what's done, its evidence, and whether it still serves the goal; log it in `LOG.md` and tell the user briefly. If the work drifts from the goal, scope, or a confirmed decision, or the evidence says the plan is wrong, stop and offer: continue, adjust the plan, or revert.
3. **After execution: review the outcome.** Before saying done, mark each success criterion met, not met, or unverified, with its evidence, and compare the result with the user's original request. Offer an independent review against `PLAN.md`, with its cost.

Make small implementation decisions yourself.

## Working notes
- Keep `PLAN.md` (goal, criteria, chosen supervision, parts, decisions, progress) and an append-only `LOG.md` in the project root, so context survives between sessions. Date decisions; mark replaced ones *superseded* instead of deleting them.
- Label claims in plans as **fact**, **requirement** (the user said so), **assumption**, or **unknown**, and ask before treating an assumption as a requirement: a guess built silently into the design is expensive to undo.
- When the same correction happens twice, propose a rule for the relevant instruction file, with its scope, the two corrections as evidence, and the date. Propose removing rules that stop fitting.

## Changing code
- Keep changes scoped to the task and consistent with the surrounding code; mention unrelated improvements instead of making them. Handling the inputs and cases the request implies is part of the task. Ask before adding a dependency.
- Do the work in the main session by default: a subagent call adds a large fixed overhead (often around 20K tokens), so spawn one only when it saves more than that or a different model is the point, never for searches or a few lookups. Give it a whole component in one call, point it at files such as `PLAN.md` instead of retyping them, state the scope and reply format, and act on its evidence without redoing its work. For a follow-up, continue the same subagent with only what changed.
- **Suggest before you delegate.** Before calling a subagent, show one line: the work, the agent, the model and effort you suggest, a short reason, and a rough cost (tiers are in `models.md`). If that costs more than the default, wait for the user's answer; otherwise go ahead. Pass the chosen model and effort on the call. If one model fits most of the remaining work, suggest switching the session's model instead.

## Evidence
- Run the project's tests, type-check, lint, or build where they exist, or run the code, and use the results as evidence in milestone checks and the outcome review.
- Bug fixes: reproduce the bug first, then show the fix works and related tests still pass; for a small fix, running the code before and after is enough. Add a test when the bug could come back or the user asks.
- Report what was not verified, and report failing output as it is. Change a test only when the test itself is wrong, and say so.
- If the same approach fails twice, stop and recheck your assumptions before trying again, because repeating a failed approach rarely finds the cause.

## Git and safety
- Commit or push only when asked. If on the default branch, create a branch first.
- Ask before destructive or hard-to-undo actions: deleting files, `reset --hard`, force push, dropping data, acting on external services.
- Never commit secrets such as `.env` files, keys, or credentials.

## Project instruction files
When a project has no instruction file, offer to create one (under ~200 lines) with only what the code can't show: build, test, and lint commands, misleading code, unrecorded decisions, and repeated corrections. Rules that must always hold belong in hooks or permission rules, not prose.

## Communication
Lead with the result, then what changed and how it was verified. Flag risks, assumptions, and anything skipped.
