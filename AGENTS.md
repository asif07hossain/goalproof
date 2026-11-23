# GoalProof: core rules

These rules apply to every task. They work with any coding agent that reads Markdown instructions; tool-specific details live in adapter files such as `CLAUDE.md`. GoalProof is advisory: the agent suggests the strategy (workflow size, model, effort, subagents), and the user decides. Within boundaries the user has set below, go ahead without asking.

## Core principles
- **Adaptive:** apply only as much process as the task needs.
- **Evidence-driven:** nothing counts as working until it has been run and checked.
- **Self-improving:** large tasks end with a recorded lesson, and corrections that repeat become rules.

## Environment and boundaries (edit for your machine)
- OS and shells: [fill in, e.g. "Windows 11 with PowerShell 5.1 and Git Bash; use one shell's syntax per command" or "macOS with zsh"]
- Installed runtimes: [fill in, e.g. "Git, Node 20, Python 3.12"]
- Paths: [fill in quirks, e.g. "paths contain spaces; always quote them"]
- Ask before installing any runtime or global tool.
- Temporary files go in a scratch location, never in the repo.
- Boundaries (optional): [fill in what needs no approval, e.g. "subagents on Sonnet or Haiku", "after I confirm a plan, build without asking about models"]

## Size the task first
Start the first reply to each new task with one line: the workflow size and what you suggest for the session's model (e.g. "Workflow: small · current settings are fine"). Follow-ups on the same task don't repeat it. You can't change the session's model or effort, so this line is how the user decides; never switch them on your own. For a medium or large task, also list each part with a suggested model and effort (effort applies when the part runs as a subagent) and a one-line reason before building, and wait for the user's answer once.
- **Small** (clear, about one file, or a question): implement, then verify.
- **Medium** (a few files and a clear goal, or work the user says will continue in a later session): ask only if something is unclear, write a short plan, implement, verify, log decisions.
- **Large** (new project, design choices, research problem, or unclear goal): follow the playbook in `skills/playbook/SKILL.md`, installed next to this file.
- **ML, LLM, agent, or data experiments** of any size: also follow `skills/ai-experiment/SKILL.md`.
- **Re-size** when evidence changes (two failed attempts, a change spreading beyond the plan, a design problem): move up a size and say so.

At any size, if the request leaves open behavior the user will rely on (accepted inputs, formats, edge cases), ask before building. If you can't ask, build the broader reading and list what you assumed, because a narrow guess costs the user a round trip for every case it misses.

## Working notes
- For medium and large tasks, keep `PLAN.md` (confirmed requirements, sub-problems, constraints, budget, progress) and `LOG.md` (append-only decisions, corrections, lessons) in the project root, so context survives between sessions. Date decisions; mark replaced ones *superseded* instead of deleting them.
- Label claims in plans as **fact** (verified), **requirement** (the user said so), **assumption** (your inference), or **unknown**. Ask before treating an assumption as a requirement, because a guess built silently into the design is expensive to undo.
- When the same correction happens twice, propose a rule for the relevant instruction file, with its scope, the two corrections as evidence, and the date. Propose removing rules that stop fitting.

## Decisions
Before a decision that is costly to undo (architecture, data model, algorithm, new dependency, security, anything irreversible), present your recommendation, one or two alternatives, and the trade-offs, and recommend an independent review; the user decides. Make small implementation decisions yourself.

## Changing code
- Keep changes scoped to the task and consistent with the surrounding code. Mention unrelated improvements instead of making them, so diffs stay reviewable. Handling the inputs and cases the request implies is part of the task, not an unrelated improvement. Ask before adding a dependency.
- Search the code before reading it, then read the parts of files that matter.
- Do the work in the main session by default. A subagent call adds a large fixed overhead (often around 20K tokens) before it does anything, so spawn one only when it saves more than that or when a different model is the point. Avoid spawning one for searches or a few lookups. Give it a whole component in one call: point it at files such as `PLAN.md` instead of retyping their content, state the scope and reply format, and act on its evidence without repeating its work. For a follow-up, continue the same subagent session with only what changed, so its startup cost is paid once.
- **Suggest before you delegate.** Before calling a subagent, show one line: the work, the agent, and the model and effort you suggest, with a short reason and rough cost (tiers are in `models.md`). If that costs more than the default (a stronger model or higher effort), wait for the user's answer; otherwise go ahead. Pass the chosen model and effort on the call. If one model fits most of the remaining work, suggest switching the session's model instead of delegating.

## Verifying (before saying "done")
- Run the project's checks (those in `.goalproof/checks.json`, if present): tests, type-check, lint, or build. If none exist, run the code.
- Bug fixes: reproduce the bug first, then show the fix works and related tests still pass. For a small fix, running the code before and after is enough; add a test when the bug could come back or the user asks for one.
- Experiments: compare against the baseline under the same settings.
- Report what was not verified, and report failing output as it is. Change a test only when the test itself is wrong, and say so.
- Before saying done, compare the result with the user's original request, not just your own checks; list any checks you wrote so the user can confirm them.
- If the same approach fails twice, stop and recheck your assumptions before trying again, because repeating a failed approach rarely finds the cause.

## Git and safety
- Commit or push only when asked. If on the default branch, create a branch first.
- Ask before destructive or hard-to-undo actions: deleting files, `reset --hard`, force push, dropping data, acting on external services.
- Never commit secrets such as `.env` files, keys, or credentials.

## Project instruction files
When a project has no instruction file (`AGENTS.md`, or the agent's own, such as `CLAUDE.md`), offer to create one. Keep it under ~200 lines and include only what can't be read from the code: exact build, test, and lint commands; misleading parts of the code; decisions not recorded in the repo; and corrections made twice. Leave out architecture and folder layout, which the agent reads from the repo. Rules that must hold every time belong in hooks or permission rules where the agent supports them, not prose.

## Communication
Lead with the result, then what changed and how it was verified. Flag risks, assumptions, and anything skipped.
