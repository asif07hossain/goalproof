// Tests for the agent-independent verification core and CLI. Run from the repo root: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as core from "./goalproof-core.mjs";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "goalproof-verify.mjs");
const node = JSON.stringify(process.execPath);
const PASS = `${node} -e "process.exit(0)"`;
const FAIL = `${node} -e "console.log('expected Hello, got Hhello'); process.exit(1)"`;
// A check that records each run in a .log file (logs don't count as code), so tests can count runs.
const COUNTED = `${node} -e "require('fs').appendFileSync('runs.log','x')"`;

function project(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gp-core-"));
  for (const [rel, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), typeof body === "string" ? body : JSON.stringify(body)); }
  return dir;
}
const checks = (run, extra = {}) => ({ ".goalproof/checks.json": { checks: [{ name: "tests", run }], ...extra } });
const edit = (dir, rel = "src/a.js", body = "export const a = 2; // changed\n") => fs.writeFileSync(path.join(dir, rel), body);
const runs = (dir) => (fs.existsSync(path.join(dir, "runs.log")) ? fs.readFileSync(path.join(dir, "runs.log"), "utf8").length : 0);

test("findChecks: the npm placeholder is not a check; a real test script is", () => {
  assert.deepEqual(core.findChecks(project({ "package.json": { scripts: { test: 'echo "Error: no test specified" && exit 1' } } })), []);
  assert.equal(core.findChecks(project({ "package.json": { scripts: { test: "node --test" } } }))[0].run, "npm test");
  assert.equal(core.findChecks(project({ "go.mod": "module x\n" }))[0].run, "go test ./...");
});
test("findChecks: .goalproof/checks.json wins over detection", () => {
  const dir = project({ "package.json": { scripts: { test: "node --test" } }, ...checks("make check") });
  assert.deepEqual(core.findChecks(dir).map((c) => c.run), ["make check"]);
});

test("fingerprint changes with code, not with docs or GoalProof's own files", () => {
  const dir = project({ "src/a.js": "export const a = 1;\n", "README.md": "# x\n" });
  const fp = core.fingerprint(dir);
  fs.writeFileSync(path.join(dir, "README.md"), "# x, longer now\n");
  fs.mkdirSync(path.join(dir, ".goalproof"), { recursive: true }); fs.writeFileSync(path.join(dir, ".goalproof", "state.json"), "{}");
  assert.equal(core.fingerprint(dir), fp);
  edit(dir);
  assert.notEqual(core.fingerprint(dir), fp);
});

test("in a git repo: untracked code counts, ignored files don't", () => {
  const dir = project({ "src/a.js": "x\n", ".gitignore": "build/\n", "build/out.js": "y\n" });
  spawnSync("git", ["init", "-q"], { cwd: dir });
  assert.deepEqual(core.codeFiles(dir), ["src/a.js"]);
  const fp = core.fingerprint(dir);
  fs.writeFileSync(path.join(dir, "build", "out.js"), "changed build output\n");
  assert.equal(core.fingerprint(dir), fp);
  fs.writeFileSync(path.join(dir, "src", "b.js"), "new file\n");
  assert.notEqual(core.fingerprint(dir), fp);
});

test("verify records evidence, and ignores its own runtime files in git", () => {
  const dir = project({ "src/a.js": "x\n", ...checks(PASS) });
  const ev = core.verify(dir);
  assert.equal(ev.passed, true);
  assert.equal(core.readEvidence(dir).fingerprint, core.fingerprint(dir));
  assert.match(fs.readFileSync(path.join(dir, ".goalproof", ".gitignore"), "utf8"), /evidence\.json/);
  const bad = core.verify(project({ "src/a.js": "x\n", ...checks(FAIL) }));
  assert.equal(bad.passed, false);
  assert.match(bad.checks[0].output, /expected Hello/);
});

test("criteriaTrace links PLAN.md success criteria to checks", () => {
  const dir = project({ "src/a.js": "x\n", ...checks(PASS), "PLAN.md": "# PLAN\n\n## Success criteria\n- [ ] Capitalizes only the first letter · check: tests\n- [ ] Handles 10,000 rows in under 5 s\n\n## Parts\n- one\n" });
  const ev = core.verify(dir);
  assert.deepEqual(ev.criteria.map((c) => c.status), ["passed", "no check"]);
  assert.match(core.summary(ev), /1 of 2/);
});

test("stop: no code change this turn -> allow, without running the checks", () => {
  const dir = project({ "src/a.js": "x\n", ...checks(COUNTED) });
  core.markTurn(dir);
  assert.equal(core.decideStop(dir).action, "allow");
  assert.equal(runs(dir), 0);
});
test("stop: code changed and checks pass -> allow, tell the user, record evidence", () => {
  const dir = project({ "src/a.js": "x\n", ...checks(PASS) });
  core.markTurn(dir); edit(dir);
  const d = core.decideStop(dir);
  assert.equal(d.action, "allow");
  assert.match(d.message, /GoalProof verified/);
  assert.equal(core.readEvidence(dir).passed, true);
});
test("stop: code changed and checks fail -> send the agent back once with the output, then let it finish", () => {
  const dir = project({ "src/a.js": "x\n", ...checks(FAIL) });
  core.markTurn(dir); edit(dir);
  const d1 = core.decideStop(dir);
  assert.equal(d1.action, "block");
  assert.match(d1.reason, /expected Hello, got Hhello/);
  edit(dir, "src/a.js", "export const a = 3; // tried again\n");
  const d2 = core.decideStop(dir, { retrying: true });
  assert.equal(d2.action, "allow");
  assert.match(d2.message, /still fail/);
});
test("stop: verified code is not re-run in a later turn", () => {
  const dir = project({ "src/a.js": "x\n", ...checks(COUNTED) });
  core.markTurn(dir); edit(dir);
  assert.equal(core.decideStop(dir).action, "allow");
  assert.equal(runs(dir), 1);
  core.markTurn(dir);
  core.decideStop(dir);
  assert.equal(runs(dir), 1);
});
test("stop: no checks -> remind once, unless the agent already ran the code or said it couldn't", () => {
  const dir = project({ "src/a.js": "x\n" });
  core.markTurn(dir); edit(dir);
  assert.equal(core.decideStop(dir, { ranCode: true }).action, "allow");
  assert.equal(core.decideStop(dir, { saidUnverified: true }).action, "allow");
  const d = core.decideStop(dir);
  assert.equal(d.action, "block");
  assert.match(d.reason, /no automatic checks/);
  assert.equal(core.decideStop(dir, { retrying: true }).action, "allow");
});
test("stop: onStop 'off' disables the check", () => {
  const dir = project({ "src/a.js": "x\n", ...checks(FAIL, { onStop: "off" }) });
  core.markTurn(dir); edit(dir);
  assert.equal(core.decideStop(dir).action, "allow");
});

test("CLI: exit 0 when checks pass, 1 when they fail, 2 when none are found and they're required", () => {
  const run = (dir, ...a) => spawnSync(process.execPath, [CLI, "--root", dir, ...a], { encoding: "utf8" });
  const ok = run(project({ "src/a.js": "x\n", ...checks(PASS) }));
  assert.equal(ok.status, 0); assert.match(ok.stdout, /verified/);
  const bad = run(project({ "src/a.js": "x\n", ...checks(FAIL) }));
  assert.equal(bad.status, 1); assert.match(bad.stdout, /NOT verified/);
  assert.equal(run(project({ "src/a.js": "x\n" })).status, 0);
  assert.equal(run(project({ "src/a.js": "x\n" }), "--require-checks").status, 2);
});
