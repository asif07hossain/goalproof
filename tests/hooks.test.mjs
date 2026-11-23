// Hook commands run on every prompt, so a broken one can stop Claude Code: a UserPromptSubmit hook that exits 2
// blocks every prompt, and bash exits 2 on a syntax error (an unquoted "(" in an echo was enough, in 0886b89).
// Every hook in the example must run cleanly in the shell Claude Code uses, and in PowerShell where one exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, "adapters/claude-code/settings.example.json"), "utf8"));
const commands = Object.entries(settings.hooks ?? {}).flatMap(([event, groups]) =>
  groups.flatMap((g) => g.hooks.filter((h) => h.type === "command").map((h) => [event, h.command])));

// On Windows, Claude Code runs hooks in Git Bash. Never use `bash` from PATH there: it can be WSL's.
function gitBash() {
  if (process.platform !== "win32") return "bash";
  if (process.env.CLAUDE_CODE_GIT_BASH_PATH) return process.env.CLAUDE_CODE_GIT_BASH_PATH;
  try {
    const exec = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(); // <Git>/mingw64/libexec/git-core
    const bash = path.join(exec, "..", "..", "..", "bin", "bash.exe");
    if (fs.existsSync(bash)) return bash;
  } catch {}
  return null;
}

function powershell() {
  for (const exe of ["pwsh", "powershell"]) {
    if (spawnSync(exe, ["-NoProfile", "-Command", "exit 0"]).status === 0) return exe;
  }
  return null;
}

function check(shell, args) {
  const r = spawnSync(shell, args, { encoding: "utf8", input: "{}" }); // hooks get JSON on stdin
  assert.equal(r.status, 0, `exit ${r.status} in ${shell}: ${r.stderr}`);
  assert.ok(r.stdout.trim(), `printed nothing in ${shell}`);
}

test("settings.example.json has hook commands to check", () => assert.ok(commands.length > 0));

for (const [event, command] of commands) {
  test(`${event} hook runs cleanly in bash`, () => {
    const bash = gitBash();
    assert.ok(bash, "Git Bash not found: set CLAUDE_CODE_GIT_BASH_PATH to Git for Windows' bin\\bash.exe");
    check(bash, ["-c", command]);
  });
  test(`${event} hook runs cleanly in PowerShell`, (t) => {
    const ps = powershell();
    if (!ps) return t.skip("no PowerShell installed");
    check(ps, ["-NoProfile", "-Command", command]);
  });
}
