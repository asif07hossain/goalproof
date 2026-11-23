// Context budget: the always-loaded rules must stay small, because long instruction files are followed less closely
// and cost tokens in every session. Raise a limit only on purpose, and say why in the commit.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const words = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").split(/\s+/).filter(Boolean).length;
const lines = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").length;
const BUDGET = [
  ["AGENTS.md", 1250, 80], // loaded in every session
  ["adapters/claude-code/CLAUDE.md", 300, 20], // loaded in every Claude Code session
  ["skills/playbook/SKILL.md", 1200, 60], // loaded only for large tasks
  ["skills/ai-experiment/SKILL.md", 1200, 60],
];
for (const [file, maxWords, maxLines] of BUDGET) {
  test(`${file} stays within ${maxWords} words and ${maxLines} lines`, () => {
    assert.ok(words(file) <= maxWords, `${file}: ${words(file)} words`);
    assert.ok(lines(file) <= maxLines, `${file}: ${lines(file)} lines`);
  });
}
