# Claude Code adapter

@AGENTS.md

## Claude Code specifics
- `skills/playbook` and `skills/ai-experiment` load as the `playbook` and `ai-experiment` skills, so they need no path.
- A large task's one stage question uses the AskUserQuestion tool, once per task and never in follow-ups: one multi-select question with the three stages. Mark the ones you recommend "(Recommended)" and give each option's benefit and rough cost, naming any reviewer it includes (e.g. "plan reviewed by the judge on Opus, about $0.05").
- The plan and outcome reviews use the `judge` subagent on the model named with the stage; suggest one different from the session's (for example Opus when the session runs on Sonnet), since it catches more of the author's blind spots. Point it at `PLAN.md` (plus the evidence, for an outcome review); for a second review, continue the same judge with SendMessage and send only the changes.
- Model tiers map to subagents (tiers are in `~/.claude/models.md`): `haiku`, `sonnet`, or `opus`, and an effort level (`low` to `max`), can be set when calling a subagent; the strongest tier (Fable) runs through the `deep` subagent. Set them only as the user or the confirmed plan chose. To move most of the remaining work to one model, suggest `/model` instead, which adds no subagent overhead.
- Permission rules in `settings.json` enforce the git and secrets rules, and a short `UserPromptSubmit` hook repeats the Workflow, stage, and delegation rules (see `adapters/claude-code/settings.example.json` in the GoalProof repo).
- Before saving a hook, run its command in bash (Git Bash on Windows) and check that it exits 0: a `UserPromptSubmit` hook that exits 2 blocks every prompt, and an unquoted `(` in an `echo` causes that. Single-quote `echo` text, with no apostrophes inside.
