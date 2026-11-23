# Claude Code adapter

@AGENTS.md

## Claude Code specifics
- `skills/playbook` and `skills/ai-experiment` load as the `playbook` and `ai-experiment` skills, so they need no path.
- Ask the supervision choice with the AskUserQuestion tool, so the user gets a selection window: one multi-select question with the three stages (before, during, and after execution). Mark the ones you recommend "(Recommended)" and give each option's benefit and rough cost.
- The independent reviews (the plan review before execution, and the outcome review after it) use the `judge` subagent, which runs on the session's model. A reviewer on a different model catches more of the author's blind spots, so suggest one with its cost (for example Opus when the session runs on Sonnet), or use the model the user names; run the review and pass `model` only once the user agrees. Point it at `PLAN.md` (plus the evidence, for an outcome review); for a second review, continue the same judge with SendMessage and send only the changes.
- Model tiers map to subagents (tiers are in `~/.claude/models.md`): `haiku`, `sonnet`, or `opus`, and an effort level (`low` to `max`), can be set when calling a subagent; the strongest tier (Fable) runs through the `deep` subagent. Set them only as the user chose. To move most of the remaining work to one model, suggest `/model` instead, which adds no subagent overhead.
- Permission rules in `settings.json` enforce the git and secrets rules, and a short `UserPromptSubmit` hook reminds you of the Workflow line, the delegation line, and the supervision choice (see `adapters/claude-code/settings.example.json` in the GoalProof repo).
