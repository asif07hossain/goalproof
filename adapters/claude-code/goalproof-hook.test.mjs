// Tests for the Claude Code adapter: input/output translation and transcript hints. Run from the repo root: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { handle, transcriptHints, runsCode } from "./goalproof-hook.mjs";

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), "goalproof-hook.mjs");
const node = JSON.stringify(process.execPath);
const prompt = (text) => ({ type: "user", message: { role: "user", content: text } });
const result = () => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "ok" }] } });
const say = (text) => ({ type: "assistant", message: { content: [{ type: "text", text }] } });
const tool = (name, input) => ({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
const jsonl = (...e) => e.map((x) => JSON.stringify(x)).join("\n");

function project(checksRun) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gp-cc-"));
  fs.mkdirSync(path.join(dir, "src")); fs.writeFileSync(path.join(dir, "src", "a.js"), "x\n");
  if (checksRun) { fs.mkdirSync(path.join(dir, ".goalproof")); fs.writeFileSync(path.join(dir, ".goalproof", "checks.json"), JSON.stringify({ checks: [{ name: "tests", run: checksRun }] })); }
  return dir;
}
const edit = (dir) => fs.writeFileSync(path.join(dir, "src", "a.js"), "export const a = 2; // changed\n");

test("transcript hints: ran code after the last edit, or said it couldn't verify", () => {
  assert.deepEqual(transcriptHints(jsonl(prompt("Fix"), tool("Edit", { file_path: "a.js" }), result(), tool("Bash", { command: "npm test" }), result(), say("Done."))), { ranCode: true, saidUnverified: false });
  assert.equal(transcriptHints(jsonl(prompt("Fix"), tool("Bash", { command: "npm test" }), result(), tool("Edit", { file_path: "a.js" }), result(), say("Done."))).ranCode, false);
  assert.equal(transcriptHints(jsonl(prompt("Fix"), tool("Edit", { file_path: "a.js" }), result(), say("Fixed, but I couldn't run it here."))).saidUnverified, true);
  assert.equal(transcriptHints(jsonl(prompt("Fix"), tool("Edit", { file_path: "a.js" }), result(), say("I didn't run into problems."))).saidUnverified, false);
  assert.equal(transcriptHints(jsonl(prompt("Fix"), tool("Edit", { file_path: "a.js" }), result(), tool("Bash", { command: "npm test" }), prompt("Next?"), say("Nothing."))).ranCode, false);
});
test("runsCode: runners count, reading files does not", () => {
  for (const c of ["npm test", "cd app && npm run test", "node -e 1", "pytest -q", "go test ./...", "FOO=1 python3 main.py", "./gradlew build", "Set-Location x; npm test"]) assert.equal(runsCode(c), true, c);
  for (const c of ["cat main.py", "ls node_modules", "git status", "grep -r foo src", "cp a.py b.py"]) assert.equal(runsCode(c), false, c);
});

test("prompt then stop with failing checks: block with Claude Code's format", async () => {
  const dir = project(`${node} -e "console.log('boom'); process.exit(1)"`);
  assert.equal(await handle("prompt", { cwd: dir }), null);
  edit(dir);
  const out = await handle("stop", { cwd: dir });
  assert.equal(out.decision, "block");
  assert.match(out.reason, /boom/);
});
test("passing checks: no block, a message for the user", async () => {
  const dir = project(`${node} -e "process.exit(0)"`);
  await handle("prompt", { cwd: dir }); edit(dir);
  const out = await handle("stop", { cwd: dir });
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /GoalProof verified/);
});
test("no checks: the transcript hint lets a turn that ran its code finish", async () => {
  const dir = project(null);
  await handle("prompt", { cwd: dir }); edit(dir);
  const t = path.join(dir, "t.jsonl");
  fs.writeFileSync(t, jsonl(prompt("Fix"), tool("Edit", { file_path: "src/a.js" }), result(), tool("Bash", { command: "node src/a.js" }), result(), say("Done.")));
  assert.equal(await handle("stop", { cwd: dir, transcript_path: t }), null);
  fs.writeFileSync(t, jsonl(prompt("Fix"), tool("Edit", { file_path: "src/a.js" }), result(), say("Done.")));
  assert.equal((await handle("stop", { cwd: dir, transcript_path: t })).decision, "block");
});
test("as a process: bad input never breaks the session", () => {
  assert.equal(execFileSync(process.execPath, [HOOK, "stop"], { input: "not json", encoding: "utf8" }), "");
  assert.equal(execFileSync(process.execPath, [HOOK, "stop"], { input: JSON.stringify({ cwd: path.join(os.tmpdir(), "does-not-exist-gp") }), encoding: "utf8" }), "");
});
