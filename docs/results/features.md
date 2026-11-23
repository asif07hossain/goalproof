# GoalProof feature evidence

**Status:** 80 of 80 runs done. Complete. Updated 2026-11-23 07:06 UTC.

## E1: what a plan review costs, and what it finds

The same plan, with 5 planted gaps, is reviewed five ways. Then the plan is revised and reviewed a second time. Main session: Sonnet, medium effort; every subagent runs on Sonnet too, so only the method differs.

| Method | Runs | Review cost | Second-review cost | Total | Subagent tokens (first review) | Subagent used | Second review | Gaps found (of 5) | Told the user which agent and model |
|---|---|---|---|---|---|---|---|---|---|
| Main agent reviews alone (no subagent) | 5 | \$0.050 | \$0.082 | \$0.132 | 0.0K | none | same agent | 5.0 | 0% |
| Default subagent, plan pasted into its prompt | 5 | \$0.122 | \$0.206 | \$0.328 | 21.8K | general-purpose | 0 continued / 5 new | 5.0 | 20% |
| GoalProof judge reading PLAN.md | 5 | \$0.084 | \$0.144 | \$0.228 | 8.5K | judge | 5 continued / 0 new | 5.0 | 80% |
| Neutral prompt, without GoalProof | 5 | \$0.115 | \$0.211 | \$0.326 | 35.5K | general-purpose | 3 continued / 2 new | 5.0 | 0% |
| Same neutral prompt, with GoalProof | 5 | \$0.104 | \$0.172 | \$0.277 | 4.7K | judge | 5 continued / 0 new | 5.0 | 100% |

**Does Claude follow GoalProof on its own?** Same neutral prompt ("have a subagent review this plan"); only the instruction files differ.

| Comparison | Without GoalProof | With GoalProof | Change [95% CI] | Evidence |
|---|---|---|---|---|
| Review cost | \$0.115 | \$0.104 | −\$0.011 [−\$0.026, +\$0.001] (−10%) | Weak (direction only) |
| Second-review cost | \$0.211 | \$0.172 | −\$0.038 [−\$0.053, −\$0.024] (−18%) | **Supported** |
| Total cost | \$0.326 | \$0.277 | −\$0.049 [−\$0.076, −\$0.024] (−15%) | **Supported** |
| Subagent tokens (first review) | 35.5K | 4.7K | −30.8K [−37.1K, −21.5K] (−87%) | **Supported** |
| Gaps found (of 5) | 5.0 | 5.0 | 0.0 [0.0, 0.0] | No difference |
| Told the user which agent and model | 0% | 100% | +100% [+100%, +100%] | **Supported** |

**The mechanism:** a default subagent given the pasted plan vs. GoalProof's judge pointed at PLAN.md, both named in the prompt.

| Comparison | Default subagent | GoalProof judge | Change [95% CI] | Evidence |
|---|---|---|---|---|
| Review cost | \$0.122 | \$0.084 | −\$0.038 [−\$0.048, −\$0.027] (−31%) | **Supported** |
| Second-review cost | \$0.206 | \$0.144 | −\$0.062 [−\$0.074, −\$0.049] (−30%) | **Supported** |
| Total cost | \$0.328 | \$0.228 | −\$0.100 [−\$0.122, −\$0.076] (−30%) | **Supported** |
| Subagent tokens (first review) | 21.8K | 8.5K | −13.3K [−21.6K, −9.0K] (−61%) | **Supported** |
| Gaps found (of 5) | 5.0 | 5.0 | 0.0 [0.0, 0.0] | No difference |

**What independence costs:** the main agent reviewing alone vs. the judge.

| Comparison | Main agent alone | GoalProof judge | Change [95% CI] | Evidence |
|---|---|---|---|---|
| Total cost | \$0.132 | \$0.228 | +\$0.096 [+\$0.068, +\$0.133] (+73%) | **Against** |
| Gaps found (of 5) | 5.0 | 5.0 | 0.0 [0.0, 0.0] | No difference |

## E2: does the agent do what GoalProof says?

Each probe is a fixed prompt, run 5 times with and without GoalProof. A run passes when the agent shows the behaviour (rules below).

| Probe | GoalProof feature | Without | With | Change [95% CI] | Evidence |
|---|---|---|---|---|---|
| understand | Asks before building a large, unclear project | 80% (5) | 100% (5) | +20 pts [0 pts, +60 pts] | Weak (direction only) |
| model | Lets the user pick the model before implementing | 0% (5) | 0% (5) | 0 pts [0 pts, 0 pts] | No difference |
| rule | Turns a correction made twice into a rule | 40% (5) | 100% (5) | +60 pts [+20 pts, +100 pts] | **Supported** |
| rigor | Demands evidence before an AI-improvement claim | 80% (5) | 100% (5) | +20 pts [0 pts, +60 pts] | Weak (direction only) |

## E3: does it suggest the model and effort? (GoalProof only, after the suggestion change)

| Situation | Check | Rate |
|---|---|---|
| Small bug fix, then a follow-up | Shows the Workflow line | 100% (5 runs) |
| Small bug fix, then a follow-up | Doesn't repeat it on the follow-up | 100% (5 runs) |
| Medium task from a confirmed plan | Shows the Workflow line | 40% (5 runs) |
| Medium task from a confirmed plan | Names a model and effort | 0% (5 runs) |
| Medium task from a confirmed plan | Waits for the user before building or delegating | 0% (5 runs) |
| Asked to use a subagent for a review | Shows the model and effort before delegating | 60% (5 runs) |
| Asked to use a subagent for a review | Waits for the user before building or delegating | 100% (5 runs) |
| Asked to use a subagent for a review | Passes an effort level on the subagent call | 60% (5 runs) |

## How each result is measured

- **Review cost:** Claude Code's reported cost for the whole turn (main agent plus any subagent), API list-price equivalent.
- **Subagent tokens:** the subagent's own token count as Claude Code reports it in the Agent tool's result. Most of it is fixed start-up context: the subagent's system prompt, tool definitions, instruction files, and brief.
- **Told the user:** the reply names the subagent (judge, general-purpose, or "subagent") and the model it ran on.
- **Gaps found:** a Haiku grader compares each review with the 5 planted gaps (duplicates, a forbidden dependency, rejected-row reporting, build order, an untested performance criterion). The same grader scores every method.
- **Second review:** after the revision, did the method continue the same subagent (SendMessage) or start a new one?
- **Probes:** `understand` passes when the agent asks questions and creates no code files; `model` when it asks which model or tier to use before writing code; `rule` when, after the same correction twice, it proposes an instruction-file, editorconfig, or lint rule; `rigor` when it says the evidence is not enough and recommends at least two of: more examples, repeated runs, a held-out set, a noise or significance estimate.
- **Evidence:** *Supported* when the 95% bootstrap CI excludes zero in GoalProof's favour; *Weak* when it is better on average but the CI includes zero; *Against* when the CI excludes zero the other way.

## Caveats

- Small, self-written test cases, one model (Sonnet), 5 runs per cell.
- The probes check that a behaviour happens, not that it helps; the convergence test ([convergence.md](convergence.md)) measures outcomes.
- Harness: [`experiments/suite.mjs`](../../experiments/suite.mjs). Raw transcripts are not in this repo.
