# Claude Code adapter

@AGENTS.md

## Claude Code specifics
- `skills/playbook` and `skills/ai-experiment` load as the `playbook` and `ai-experiment` skills, so they need no path.
- Playbook step 2.1 uses the `judge` subagent, which runs on the session's model. A reviewer on a different model catches more of the author's blind spots, so suggest one with its cost (for example Opus when the session runs on Sonnet), or use the model the user names; run the review and pass `model` only once the user agrees. Point it at `PLAN.md`; for a second review, continue the same judge with SendMessage and send only the changes, instead of spawning a new one.
- Model tiers map to subagents: `haiku`, `sonnet`, or `opus`, and an effort level (`low` to `max`), can be set when calling a subagent; the strongest tier (Fable) runs through the `deep` subagent. Set them only as the user chose. To move most of the remaining work to one model, suggest `/model` instead, which adds no subagent overhead.
- `models.md` is at `~/.claude/models.md`.
- Permission rules in `settings.json` enforce the git and secrets rules, and two hooks connect GoalProof's verifier (see `adapters/claude-code/settings.example.json` in the GoalProof repo). When a turn changed code, the `Stop` hook runs the project's checks; if they fail, you get the output and one more turn to fix the cause or say why it can't pass.
