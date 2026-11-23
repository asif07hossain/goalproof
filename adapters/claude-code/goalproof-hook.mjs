#!/usr/bin/env node
// GoalProof adapter for Claude Code hooks. It only translates: Claude Code's hook input -> the agent-independent
// core in verify/goalproof-core.mjs -> Claude Code's hook output. All decisions live in the core.
//   UserPromptSubmit:  node goalproof-hook.mjs prompt   (remembers the code state at the start of the turn)
//   Stop:              node goalproof-hook.mjs stop     (runs the project's checks if this turn changed code)
// Any error lets Claude Code continue, so the hook can never break a session.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Installed: the core sits next to this file. In the repo: verify/ is two folders up.
const corePath = fs.existsSync(path.join(here, "goalproof-core.mjs")) ? path.join(here, "goalproof-core.mjs") : path.join(here, "..", "..", "verify", "goalproof-core.mjs");

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
const RUNNER = /^((npm|pnpm|yarn|bun)\s+(run\s+)?(test|build|lint|check|typecheck|start|dev|exec)\b|(npx|bunx|node|deno|tsx|ts-node|python3?|py|pytest|uv\s+run|poetry\s+run|ruby|rspec|bundle\s+exec|php|phpunit|java|javac|go\s+(run|test|build|vet)|cargo\s+(run|test|build|check)|dotnet\s+(run|test|build)|mvn|gradle|\.\/gradlew|make|cmake|ctest|jest|vitest|mocha|tsc|swift|julia|Rscript|perl)\b|(bash|sh|zsh|pwsh|powershell)\s+(-File\s+)?\S+\.(sh|ps1)\b|\.{1,2}[\\/]\S+)/i;
const SAID_UNVERIFIED = /\b(could not|couldn't|was not able to|wasn't able to|unable to|can't|cannot|did not|didn't|have not|haven't)\s+(run|test|verify|execute)\b(?!\s+into)|\b(not|un)\s?(verified|tested)\b/i;

export const runsCode = (command) => String(command).split(/&&|\|\||;|\||\r?\n/).some((seg) =>
  RUNNER.test(seg.trim().replace(/^(\w+=\S*\s+)+/, "").replace(/^(sudo|time|timeout\s+\d+\w?|env)\s+/, "")));

// Hints from Claude Code's transcript, used only when the project has no checks the core can run:
// did the agent run code after its last edit this turn, and did it already say it couldn't verify?
export function transcriptHints(text) {
  const events = String(text).split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  let start = 0;
  events.forEach((e, i) => {
    if (e.type !== "user" || e.isMeta) return;
    const c = e.message?.content;
    if (typeof c === "string" || (Array.isArray(c) && c.length > 0 && c.every((b) => b.type === "text"))) start = i + 1;
  });
  let seq = 0, lastEdit = -1, lastRun = -1, lastText = "";
  for (const e of events.slice(start)) {
    if (e.type !== "assistant" || !Array.isArray(e.message?.content)) continue;
    for (const b of e.message.content) {
      seq++;
      if (b.type === "text" && b.text) lastText = b.text;
      if (b.type !== "tool_use") continue;
      if (EDIT_TOOLS.has(b.name)) lastEdit = seq;
      else if (SHELL_TOOLS.has(b.name) && runsCode(b.input?.command ?? "")) lastRun = seq;
    }
  }
  return { ranCode: lastEdit >= 0 && lastRun > lastEdit, saidUnverified: SAID_UNVERIFIED.test(lastText) };
}

function readTail(p, max = 8 * 1024 * 1024) {
  try {
    const size = fs.statSync(p).size;
    if (size <= max) return fs.readFileSync(p, "utf8");
    const fd = fs.openSync(p, "r"), buf = Buffer.alloc(max); fs.readSync(fd, buf, 0, max, size - max); fs.closeSync(fd);
    return buf.toString("utf8").slice(buf.indexOf("\n") + 1);
  } catch { return ""; }
}

export async function handle(mode, input) {
  const core = await import(pathToFileURL(corePath).href);
  const root = core.projectRoot(input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
  if (mode === "prompt") { core.markTurn(root); return null; }
  if (mode !== "stop") return null;
  const hints = input.transcript_path ? transcriptHints(readTail(input.transcript_path)) : {};
  const d = core.decideStop(root, { retrying: !!input.stop_hook_active, ...hints });
  if (d.action === "block") return { decision: "block", reason: d.reason };
  return d.message ? { systemMessage: d.message } : null;
}

if (process.argv[1] && /goalproof-hook\.mjs$/.test(process.argv[1])) {
  let raw = "";
  process.stdin.on("data", (d) => (raw += d));
  process.stdin.on("end", async () => {
    try {
      const out = await handle(process.argv[2], JSON.parse(raw || "{}"));
      if (out) process.stdout.write(JSON.stringify(out));
    } catch { /* never break the session */ }
  });
}
