# Model tiers

The playbook names tiers, not models, so it works with any provider. Map each tier to the models your agent can use, and update this file when models or prices change.

| Tier | Use for | Claude (checked 2026-11-22) | Your provider |
|---|---|---|---|
| cheap | search, lookups, summaries, formatting | Haiku 5.5 (`claude-haiku-5-5`), $0.10 / $0.50 | |
| balanced | routine code, tests, docs | Sonnet 5.5 (`claude-sonnet-5-5`), $2 / $10 | |
| strong | features, refactors, debugging | Opus 5.5 (`claude-opus-5-5`), $4 / $20 | |
| strongest | architecture, hard bugs, research algorithms | Fable 5.2 (`claude-fable-5-2`), $8 / $40 | |

Prices are per 1M input / output tokens. Haiku's price is for prompts up to 100K tokens ($0.50 / $2.50 above). Claude effort levels, lowest to highest: `low`, `medium`, `high`, `xhigh`, `max`.

Each subagent call adds a large fixed overhead (often around 20K tokens), so delegate whole components, not small steps. To move most of the remaining work to one model, switch the session's model instead.

## Claude Code
- Session model: `/model`. Default effort per model: `modelSettings` in `~/.claude/settings.json`.
- Subagents: the `model` field in an agent definition (`haiku`, `sonnet`, `opus`, `fable`, a full model ID, or `inherit`). When calling a subagent, the model can be overridden with `haiku`, `sonnet`, or `opus` only; the strongest tier runs through the `deep` agent.
- No API key or code is needed: subagents use the account Claude Code is signed in with and count toward the same usage limits as the main conversation. Fable is not the default on any plan and, depending on plan and seat tier, can draw on usage credits. If the account can't use a chosen model, Claude Code runs the subagent on a fallback model.

## Other agents
Fill in the "Your provider" column with the models your agent offers, and switch models the way it allows (a model picker, a command, or a config setting).
