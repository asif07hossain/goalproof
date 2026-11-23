#!/usr/bin/env node
// GoalProof verify: runs the project's checks, records the evidence in .goalproof/evidence.json, and shows which
// success criteria in PLAN.md have passing checks. Works the same for any agent, a git hook, or CI.
// Usage: node goalproof-verify.mjs [--root DIR] [--require-checks] [--json]
// Exit codes: 0 all checks passed (or none found without --require-checks), 1 a check failed, 2 no checks found with --require-checks.
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const core = await import(fs.existsSync(path.join(here, "goalproof-core.mjs")) ? "./goalproof-core.mjs" : "../verify/goalproof-core.mjs");

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const root = core.projectRoot(opt("--root") ?? process.cwd());
const ev = core.verify(root);

if (args.includes("--json")) console.log(JSON.stringify(ev, null, 2));
else if (!ev.checksFound) console.log(`GoalProof: no checks found in ${root}. Add .goalproof/checks.json, e.g. {"checks":[{"name":"tests","run":"npm test"}]}.`);
else {
  for (const c of ev.checks) {
    console.log(`${c.exitCode === 0 ? "PASS" : "FAIL"}  ${c.run}  (${(c.ms / 1000).toFixed(1)} s)`);
    if (c.exitCode !== 0) console.log(c.output.split("\n").map((l) => "      " + l).join("\n"));
  }
  for (const c of ev.criteria) console.log(`${c.status === "passed" ? "  ok" : "  --"}  criterion: ${c.criterion}${c.check ? `  [check: ${c.check}, ${c.status}]` : "  [no automatic check]"}`);
  console.log(`GoalProof: ${ev.passed ? "verified" : "NOT verified"}. Evidence: ${path.join(root, ".goalproof", "evidence.json")}`);
}
process.exitCode = !ev.checksFound ? (args.includes("--require-checks") ? 2 : 0) : ev.passed ? 0 : 1;
