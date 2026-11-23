---
name: ai-experiment
description: Rigor for ML, LLM, agent, and data experiments - training, fine-tuning, model or prompt comparisons, benchmarks, or any claim that an AI system improved.
---

# AI experiment rigor

Use alongside the `playbook` skill for large tasks. Record the eval design and budget in `PLAN.md`, and log each run in `LOG.md`. Most surprising results turn out to be bugs in the eval, not facts about the model, so check the eval before trusting it.

## Before building: decide how success is measured
- **Write the eval first:** the cases, the metric, and the smallest improvement worth acting on.
- **Split the data at random** into train, validation, and test (stratified if classes or task types are uneven). Tune only on train and validation. Use test once, for the final report, because repeated checks turn it into training data.
- **Prevent leakage structurally.** No test items, or near-duplicates, in training data, prompts, few-shot examples, or any file the system under test can read. An instruction not to look is not protection.
- **Run the baseline first**, with the same settings the candidate will use, and repeat it to see the run-to-run noise.
- **Check the eval can detect the change.** For a pass rate, the noise is roughly 1/sqrt(cases x repeats): 25 cases x 2 repeats is about +/-14 points. If the noise is larger than the improvement you're after, add cases or repeats before spending on experiments.
- **Test the harness on known answers.** An oracle (reference answers) should score near 100%; a null baseline (empty or constant output) should fail. If either doesn't, the harness or grader is broken.
- **Estimate cost before a full run** (API tokens at `models.md` prices, GPU-hours, wall-clock), run a small pilot end to end, and get approval for anything large.

## Running experiments
- **Change one thing per experiment**, so results can be attributed.
- **Make runs reproducible:** fix and record seeds, pin dependencies, and save the config, code commit, data version, and model ID with every run (for example in `runs/<run-id>/`).
- **Separate infrastructure failures from model failures.** Timeouts, rate limits, crashes, and truncated outputs are errors to log and retry, never scores of zero.
- **Save full outputs or trajectories for every case**, so a surprising score can be traced without re-running.
- **Use fresh, isolated state per trial** for agents that act on an environment, and grade the end state (tests pass, expected files exist, nothing off-limits touched), not the transcript.
- **Record cost and latency from real data:** tokens from the API's usage fields and actual GPU time, reported next to quality.

## LLM-as-judge
- **Use a concrete rubric** of checkable properties, each scored separately rather than blended into one number.
- **Avoid known biases:** use a different model (ideally a different family) from the system under test, randomize A/B order, tell the judge not to reward length, and don't reveal which output is the baseline.
- **Calibrate before trusting it:** compare against a few dozen human labels and report agreement, and confirm it fails empty answers, "I don't know", and answers to the wrong question.

## Reporting
- Report the mean with its spread or confidence interval, the number of cases and repeats, and the baseline under identical settings.
- Recompute headline numbers from per-case results rather than trusting an aggregate.
- Ablate: switch the claimed mechanism off and confirm the score drops.
- Read a sample of failures before believing any number.
- Report null and negative results, and say what was not tested.

## Related tools
In Claude Code, apps built on Claude can use the built-in `claude-api` skill's guided flows: `/claude-api build-eval` to build an eval and `/claude-api hillclimb` to improve against one.
