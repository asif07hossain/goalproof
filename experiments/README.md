# Experiments

The scripts behind the [Results](../README.md#results). Each runs Claude Code headless, with GoalProof on and off, on the same tasks, and writes a Markdown report.

| Script | What it tests | Report |
|---|---|---|
| [`conv.mjs`](conv.mjs) | Convergence: unclear coding tasks, a second session, and a 4-session project. Hidden checks grade the code, and a simulated user answers the agent's questions. | [convergence.md](../docs/results/convergence.md) |
| [`suite.mjs`](suite.mjs) | Features: subagent plan review (E1), rule-following probes (E2), and the suggestion behaviour (E3, GoalProof only). | [features.md](../docs/results/features.md) |

## Before you run

- **Node 20** and **Claude Code**, signed in. The scripts look for the Claude Code binary in this order: the `CLAUDE_BIN` environment variable, the newest Claude Code VS Code extension, then `claude` on your `PATH`. On Windows, set `CLAUDE_BIN` to the full path of `claude.exe` if the lookup fails.
- **GoalProof installed for Claude Code** in `~/.claude`, as described under [Install](../README.md#claude-code-all-projects), including the hooks in `adapters/claude-code/settings.example.json`. The "with GoalProof" side uses your `~/.claude` setup as it is. The published results were measured before the verifier hooks existed; to reproduce them, leave the `Stop` hook and the `prompt` hook out.
- **The baseline side switches GoalProof off** through a generated `--settings` file. That file excludes `~/.claude/CLAUDE.md` and `AGENTS.md`, turns off the `playbook` and `ai-experiment` skills, denies the `judge` and `deep` subagents, and disables hooks. Your other settings in `~/.claude`, such as permissions and other skills, apply to both sides. Anything else you've added to `~/.claude/CLAUDE.md` reaches only the GoalProof side, so use a clean install for a fair comparison.
- **Cost.** A full run of each script was about \$17 at API list prices (Sonnet, medium effort, with Haiku as the simulated user and as the grader for plan-review gaps). On a subscription, it counts toward your usage limits. When it hits a limit, the script waits for the reset and retries the interrupted run from scratch.
- **Safety.** Each run happens in a fresh folder under the script's output directory. The agent can edit files there with `--permission-mode acceptEdits` and run only `node` and `npm test`.

## Run

```bash
cd experiments
node conv.mjs selftest      # no model calls: checks that each task's starter code fails and its reference solution passes
node conv.mjs run           # resumable: run it again to continue after a stop or a crash
node conv.mjs stop          # stops before the next run; a run in progress finishes first
node conv.mjs report        # rebuilds REPORT-conv.md from the saved state

node suite.mjs run          # E1, E2, and E3
node suite.mjs report       # rebuilds REPORT-features.md
```

`conv.mjs` writes to `conv/` by default. Set `CONV_OUT` to use another folder: the published results used `CONV_OUT=conv2`. `suite.mjs` writes to `suite/`. Both folders, and the reports, are ignored by git.

## Reading the output

- `<out>/state.json` holds every run's measurements. `<out>/runs/<id>.log` holds the full Claude Code transcript, one stream-JSON event per line, and `<out>/runs/<id>/` holds the files the agent left behind.
- `<out>/progress.log` records each start, finish, and pause.
- Hidden checks never enter a run's folder. The grader loads the agent's module in a separate process, and when a check fails, it sends back one fixed-form correction ("I ran `f(x)` and got `y`, but I expected `z`.").
