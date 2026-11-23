// Feature evidence for GoalProof.
// E1: plan review done three ways (main agent alone, default subagent with a pasted plan, GoalProof judge
//     reading PLAN.md): cost, subagent start-up overhead, and how many planted gaps each finds.
// E2: behaviour probes: does the agent do what GoalProof says, with and without it?
// E3: GoalProof only: does it suggest the workflow, model, and effort, and wait when it should?
// Usage: node suite.mjs run | report | stop. Resumable; waits out usage limits like conv.mjs.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "suite"), RUNS = path.join(OUT, "runs"), SIM = path.join(OUT, "sim");
const STATE = path.join(OUT, "state.json"), LOCK = path.join(OUT, "lock"), STOP = path.join(OUT, "STOP"), PROGRESS = path.join(OUT, "progress.log");
const REPORT = path.join(ROOT, "REPORT-features.md"), BASE = path.join(OUT, "baseline-settings.json");
const MODEL = ["--model", "sonnet", "--effort", "medium"], REPS = 5;
for (const d of [RUNS, SIM]) fs.mkdirSync(d, { recursive: true });
fs.writeFileSync(BASE, JSON.stringify({
  claudeMdExcludes: ["**/.claude/CLAUDE.md", "**/.claude/AGENTS.md", ...["CLAUDE.md", "AGENTS.md"].map((n) => path.join(os.homedir(), ".claude", n).replace(/\\/g, "/"))],
  skillOverrides: { playbook: "off", "ai-experiment": "off" },
  permissions: { deny: ["Agent(judge)", "Agent(deep)"] },
  disableAllHooks: true,
}, null, 2));
const PKG = JSON.stringify({ name: "toy", type: "module", scripts: { test: "node --test" } }, null, 2);

// ---------- E1 material ----------
const PLAN = `# PLAN: CSV import for the expense tracker

## Goal (confirmed)
Users upload a bank CSV export and the app adds the transactions to their expense list. Success: a 10,000-row file imports in under 5 seconds, duplicates are never imported twice, and every rejected row is reported to the user with a reason.

## Constraints
- Node 20. No new dependencies: the team must approve any package.
- The existing \`expenses\` table schema must not change.
- Files up to 20 MB.

## Breakdown
1. Upload endpoint: accepts the file and stores it in a temp folder. Test: upload a sample file and check it is stored.
2. CSV parser: uses the \`papaparse\` package to read rows. Test: parse sample files.
3. Row mapper: maps bank columns to expense fields. Test: unit tests with three bank formats.
4. Importer: writes mapped rows to the \`expenses\` table. Test: import the sample file and count rows.
5. Results page: shows how many rows were imported. Test: manual check.

Build order: 4, 1, 2, 3, 5.
`;
const PLAN2 = PLAN.replace("uses the `papaparse` package to read rows", "a small built-in parser that reads rows (no packages)").replace("Build order: 4, 1, 2, 3, 5.", "Build order: 2, 3, 4, 1, 5.");
const GAPS = [
  "Duplicates: the goal says duplicates are never imported twice, but no part of the plan detects duplicates.",
  "Dependency: the parser uses the papaparse package, which breaks the no-new-dependencies constraint.",
  "Rejected rows: the goal says every rejected row is reported with a reason, but no part validates rows or reports rejections.",
  "Build order: the importer (4) is built first, before the parser (2) and mapper (3) it depends on.",
  "Performance: nothing tests the 10,000-rows-in-under-5-seconds criterion.",
];
const REVISION = "I revised the plan: the build order is now 2, 3, 4, 1, 5, and the parser no longer uses papaparse.";
// Neutral prompts: identical with and without GoalProof, so only the instruction files differ.
const NEUTRAL1 = "Have a subagent review this plan for gaps that would cause a part to be built wrong or not at all, then list its findings, one line per gap. The plan is also saved in PLAN.md.\n\n" + PLAN;
const NEUTRAL2 = `${REVISION} PLAN.md is updated. Have the reviewer check the revised plan and list the gaps that remain.`;
const E1 = {
  self: { goalproof: false, planFile: true, label: "Main agent reviews alone (no subagent)",
    p1: "Review the plan in PLAN.md for gaps that would cause a part to be built wrong or not at all. Do the review yourself; don't use subagents. List each gap in one line.",
    p2: `${REVISION} PLAN.md is updated. Re-check it yourself and list the gaps that remain.` },
  default: { goalproof: false, planFile: false, label: "Default subagent, plan pasted into its prompt",
    p1: "Have the general-purpose subagent (model: sonnet) review the plan below for gaps that would cause a part to be built wrong or not at all. Paste the full plan into its prompt. Then list its findings, one line per gap.\n\n" + PLAN,
    p2: `${REVISION} Have a general-purpose subagent (model: sonnet) re-review the full revised plan below and list the gaps that remain.\n\n` + PLAN2 },
  judge: { goalproof: true, planFile: true, label: "GoalProof judge reading PLAN.md",
    p1: "Have the judge subagent (model: sonnet) review PLAN.md. Then list its findings, one line per gap.",
    p2: `${REVISION} PLAN.md is updated. Continue the same judge with SendMessage and send only what changed, then list the gaps that remain.` },
  base: { goalproof: false, planFile: true, label: "Neutral prompt, without GoalProof", p1: NEUTRAL1, p2: NEUTRAL2 },
  goalproof: { goalproof: true, planFile: true, label: "Same neutral prompt, with GoalProof", p1: NEUTRAL1, p2: NEUTRAL2 },
};

// ---------- E2 probes ----------
const MPLAN = `# PLAN (confirmed by the user)

## Goal
A command-line tool that tracks the books I'm reading: add a book, mark it finished, and print a yearly summary.

## Components
1. Storage: read and write books to books.json. Test: round-trip unit tests.
2. CLI: \`add\`, \`finish\` and \`summary\` commands. Test: run each command on a temp file.
3. Summary report: books finished per month for a given year. Test: unit tests with fixed data.

## Constraints
Node 20, no dependencies.

## Status
Requirements and breakdown confirmed. Next: implementation.
`;
const PROBES = {
  understand: { feature: "Asks before building a large, unclear project", files: {},
    turns: ["I want to build a web app that tracks my reading list, with user accounts and a mobile-friendly UI. Let's start."],
    pass: (ts, d) => ts[0].text.includes("?") && d.created === 0 },
  model: { feature: "Lets the user pick the model before implementing", files: { "PLAN.md": MPLAN, "package.json": PKG },
    turns: ["PLAN.md is confirmed. Implement it."],
    pass: (ts, d) => /\b(haiku|sonnet|opus|fable|tiers?|effort)\b/i.test(ts[0].all) && ts[0].text.includes("?") && d.created === 0 },
  rule: { feature: "Turns a correction made twice into a rule", files: { "package.json": PKG },
    turns: ["Add a function `add(a, b)` to src/math.js.", "Correction: this project uses 4-space indentation. Please fix it.",
      "Now add `multiply(a, b)` to src/math.js.", "Correction again: this project uses 4-space indentation. Please fix it."],
    pass: (ts) => /AGENTS\.md|CLAUDE\.md|instruction file|editorconfig|prettier|eslint/i.test(ts[3].all) },
  rigor: { feature: "Demands evidence before an AI-improvement claim", files: {},
    turns: ["I changed my summarization prompt. I ran the old and the new prompt once each on 3 examples: the new one averaged 8/10 and the old one 7/10. Can I say the new prompt is better? Answer in a few sentences."],
    pass: (ts) => { const t = ts[0].all;
      const no = /\bno\b|\bnot yet\b|not with (any )?confidence|within (the )?noise|not (yet )?(enough|sufficient)|can'?t|cannot|too (few|small)|premature|insufficient/i.test(t);
      const recs = [/more (examples|samples|data|test cases)|larger (set|sample)/i, /repeat|multiple runs|several runs|more runs|run (each|it|them|both) (several|multiple|more)/i,
        /held.?out|test set|split|unseen/i, /noise|varian|significan|confidence|standard (error|deviation)|random/i].filter((r) => r.test(t)).length;
      return no && recs >= 2; } },
};

// ---------- E3: the suggestion behaviour (after the "suggest model and effort" change), GoalProof only ----------
const WF = /workflow:[^\n]*/i;
const E3 = {
  small: { label: "Small bug fix, then a follow-up", files: { "package.json": PKG, "src/text.js": "export function capitalize(s) {\n  return s[0].toUpperCase() + s.slice(0);\n}\n" },
    turns: ['`capitalize` in src/text.js returns "Hhello" for "hello". It should uppercase only the first letter. Fix it.', "Run the tests once more and tell me the result."],
    score: (ts) => ({ line: WF.test(ts[0].all) ? 1 : 0, noRepeat: WF.test(ts[1].all) ? 0 : 1 }) },
  medium: { label: "Medium task from a confirmed plan", files: { "PLAN.md": MPLAN, "package.json": PKG },
    turns: ["PLAN.md is confirmed. Implement it."],
    score: (ts, d) => ({ line: WF.test(ts[0].all) ? 1 : 0, table: /\b(haiku|sonnet|opus|fable)\b/i.test(ts[0].all) && /\beffort\b/i.test(ts[0].all) ? 1 : 0, waited: d.created === 0 ? 1 : 0 }) },
  delegate: { label: "Asked to use a subagent for a review", files: { "PLAN.md": PLAN, "package.json": PKG },
    turns: ["Have a subagent review PLAN.md for gaps that would cause a part to be built wrong or not at all.", "Go ahead with what you suggested."],
    score: (ts) => { const calls = [...ts[0].calls, ...(ts[1]?.calls ?? [])];
      return { delegLine: /\b(haiku|sonnet|opus|fable)\b/i.test(ts[0].all) && /\beffort\b/i.test(ts[0].all) ? 1 : 0,
        waited: ts[0].calls.length === 0 ? 1 : 0, effortPassed: calls.length && calls[0].effort ? 1 : 0 }; } },
};
const E3_CHECKS = { line: "Shows the Workflow line", noRepeat: "Doesn't repeat it on the follow-up", table: "Names a model and effort", waited: "Waits for the user before building or delegating",
  delegLine: "Shows the model and effort before delegating", effortPassed: "Passes an effort level on the subagent call" };

// ---------- helpers ----------
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function save(f, s) { for (let i = 0; ; i++) { try { fs.writeFileSync(f, s); return; } catch (e) { if (i >= 4) throw e; sleepSync(500); } } }
function log(msg) { try { fs.appendFileSync(PROGRESS, `${new Date().toISOString()} ${msg}\n`); } catch {} console.log(msg); }
function writeTree(dir, files) { for (const [rel, body] of Object.entries(files)) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); } }
function codeFiles(dir) { const out = []; const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
  if (f.name.startsWith(".") || f.name === "node_modules") continue; const p = path.join(d, f.name);
  if (f.isDirectory()) walk(p); else if (!/\.md$/i.test(f.name) && !/^package(-lock)?\.json$/.test(f.name)) out.push(p); } }; walk(dir); return out; }
const cmpVer = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 4; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0); return 0; };
function findCli() { // CLAUDE_BIN if set, else the newest Claude Code VS Code extension binary, else `claude` on PATH
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const ext = path.join(os.homedir(), ".vscode", "extensions");
  const dirs = (fs.existsSync(ext) ? fs.readdirSync(ext) : []).map((d) => [d, d.match(/^anthropic\.claude-code-([\d.]+)/)?.[1]]).filter((x) => x[1]).sort((a, b) => cmpVer(b[1], a[1]));
  for (const [d] of dirs) for (const b of ["claude.exe", "claude"]) { const p = path.join(ext, d, "resources", "native-binary", b); if (fs.existsSync(p)) return p; }
  return "claude";
}
function cli(args, cwd) { return new Promise((res) => {
  let out = "", err = "", done = false; const finish = (code) => { if (!done) { done = true; clearTimeout(t); res({ code, out, err }); } };
  const child = spawn(findCli(), args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (err += d));
  const t = setTimeout(() => child.kill(), 10 * 60 * 1000);
  child.on("close", finish); child.on("error", (e) => { err += String(e); finish(-1); }); }); }
class LimitError extends Error {}
const LIMIT_RE = /usage limit|limit reached|hit your (usage )?limit|out of (extra )?usage|rate.?limit|overloaded/i;
const ctx = (u) => (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
async function turn(cwd, prompt, extra, logFile) {
  const r = await cli(["-p", prompt, "--output-format", "stream-json", "--verbose", ...extra], cwd);
  fs.appendFileSync(logFile, `#PROMPT ${prompt.slice(0, 400)}\n${r.out}${r.err ? "#STDERR " + r.err + "\n" : ""}#END\n`);
  const ev = r.out.split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const res = ev.filter((e) => e.type === "result").at(-1);
  const limitText = /usage limit|hit your (usage )?limit|out of extra usage/i.test(res?.result ?? "") && !(res?.total_cost_usd > 0);
  if (!res || res.is_error || limitText) {
    const blob = (res ? JSON.stringify(res) : "") + r.out.slice(-1500) + r.err.slice(-1500);
    if (LIMIT_RE.test(blob)) throw new LimitError(blob.slice(0, 400));
    throw new Error(`turn failed (exit ${r.code}): ${blob.slice(0, 400)}`);
  }
  const s = stats(ev);
  return { sid: res.session_id, text: res.result ?? "", all: s.all, cost: res.total_cost_usd ?? 0, secs: (res.duration_ms ?? 0) / 1000,
    spawns: s.spawns, resumes: s.resumes, subTokens: s.subTokens, subFirstCtx: s.subCtx, types: s.types, calls: s.calls };
}
// Subagent accounting from the stream. Claude Code reports each subagent's own token count in the
// Agent tool's result (tool_use_result.totalTokens and .usage), which covers subagents whose steps are not streamed.
function stats(ev) {
  const tools = [], texts = [], types = [], agentRes = [], calls = []; let asyncTokens = 0;
  for (const e of ev) {
    if (e.type === "assistant" && !e.parent_tool_use_id) for (const b of e.message?.content ?? []) {
      if (b.type === "tool_use") { tools.push(b.name); if (/^(Agent|Task)$/.test(b.name)) { types.push(b.input?.subagent_type ?? "general-purpose"); calls.push({ model: b.input?.model ?? null, effort: b.input?.effort ?? null }); } }
      if (b.type === "text") texts.push(b.text); }
    if (e.type === "user" && !e.parent_tool_use_id && e.tool_use_result && typeof e.tool_use_result === "object" && e.tool_use_result.usage) agentRes.push(e.tool_use_result);
    if (e.type === "system" && e.subtype === "task_notification" && e.usage) asyncTokens += e.usage.total_tokens ?? 0;
  }
  const res = ev.filter((e) => e.type === "result").at(-1) ?? {};
  return { calls, all: texts.join("\n") + "\n" + (res.result ?? ""), final: res.result ?? "", types,
    spawns: tools.filter((n) => /^(Agent|Task)$/.test(n)).length, resumes: tools.filter((n) => n === "SendMessage").length,
    subTokens: agentRes.reduce((s, x) => s + (x.totalTokens ?? 0), 0) + asyncTokens, subCtx: agentRes.length ? mean(agentRes.map((x) => ctx(x.usage))) : null };
}
const parseBlock = (b) => b.split(/\r?\n/).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const toldUser = (text) => /\b(judge|general-purpose|subagent|sub-agent)\b/i.test(text) && /\b(haiku|sonnet|opus|fable)\b/i.test(text);
function logStats(id) { // recomputed from the saved transcript, so older runs get the same accounting
  try { const blocks = fs.readFileSync(path.join(RUNS, id + ".log"), "utf8").split("#END").map(parseBlock);
    const s1 = stats(blocks[0]), s2 = stats(blocks[1] ?? []);
    return { sub1: s1.subTokens, sub2: s2.subTokens, subCtx1: s1.subCtx, types1: s1.types, types2: s2.types, resumes2: s2.resumes, spawns2: s2.spawns, told: toldUser(s1.final) ? 1 : 0 };
  } catch { return {}; } }
const ARGS = (goalproof, sid) => ["--permission-mode", "acceptEdits", "--allowedTools", "Bash(node *)", "Bash(npm test*)", "Bash(npm run test*)", ...MODEL,
  ...(goalproof ? [] : ["--settings", BASE]), ...(sid ? ["--resume", sid] : [])];
async function gradeGaps(text, logFile) {
  const prompt = `Below is a review of a project plan. For each of the ${GAPS.length} known gaps, decide whether the review identifies it, in any wording. Known gaps: ${GAPS.map((g, i) => `(${i + 1}) ${g}`).join(" ")} Review: """${text.replace(/\s+/g, " ").slice(0, 6000)}""" Reply with only ${GAPS.length} digits, 1 if the review identifies that gap and 0 if not, for example 10110.`;
  const g = await turn(SIM, prompt, ["--model", "haiku", "--settings", BASE, "--no-session-persistence"], logFile);
  const m = g.text.match(/[01]{5}/); return m ? [...m[0]].map(Number) : null;
}

// ---------- runs ----------
function freshDir(id) { const dir = path.join(RUNS, id), logFile = path.join(RUNS, id + ".log"); fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(logFile, { force: true }); fs.mkdirSync(dir, { recursive: true }); return { dir, logFile }; }
async function runE1(arm, rep) {
  const A = E1[arm], id = `E1-${arm}-r${rep}`, { dir, logFile } = freshDir(id);
  writeTree(dir, { "package.json": PKG, ...(A.planFile ? { "PLAN.md": PLAN } : {}) });
  const t1 = await turn(dir, A.p1, ARGS(A.goalproof, null), logFile);
  if (A.planFile) fs.writeFileSync(path.join(dir, "PLAN.md"), PLAN2);
  const t2 = await turn(dir, A.p2, ARGS(A.goalproof, t1.sid), logFile);
  const found = await gradeGaps(t1.all, logFile);
  return { id, exp: "E1", arm, rep, cost1: t1.cost, cost2: t2.cost, cost: t1.cost + t2.cost, secs: t1.secs + t2.secs, spawns1: t1.spawns, spawns2: t2.spawns, resumes2: t2.resumes,
    sub1: t1.subTokens, sub2: t2.subTokens, subCtx1: t1.subFirstCtx, subCtx2: t2.subFirstCtx, found, gaps: found ? found.reduce((s, x) => s + x, 0) : null };
}
async function runE2(probe, arm, rep) {
  const P = PROBES[probe], id = `E2-${probe}-${arm}-r${rep}`, { dir, logFile } = freshDir(id);
  writeTree(dir, P.files);
  const before = codeFiles(dir).length, ts = []; let sid = null, created = 0;
  for (const msg of P.turns) { const t = await turn(dir, msg, ARGS(arm === "B_goalproof", sid), logFile); sid = t.sid; ts.push(t); if (ts.length === 1) created = codeFiles(dir).length - before; }
  return { id, exp: "E2", probe, arm, rep, pass: P.pass(ts, { created }) ? 1 : 0, created, cost: ts.reduce((s, t) => s + t.cost, 0), answer: ts.at(-1).text.slice(0, 600) };
}

async function runE3(probe, rep) {
  const P = E3[probe], id = `E3-${probe}-r${rep}`, { dir, logFile } = freshDir(id);
  writeTree(dir, P.files);
  const before = codeFiles(dir).length, ts = []; let sid = null, created = 0;
  for (const msg of P.turns) { const t = await turn(dir, msg, ARGS(true, sid), logFile); sid = t.sid; ts.push(t); if (ts.length === 1) created = codeFiles(dir).length - before; }
  return { id, exp: "E3", probe, rep, score: P.score(ts, { created }), cost: ts.reduce((s, x) => s + x.cost, 0) };
}

// ---------- report ----------
function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function diffCI(a, b) { const r = rng(42), rs = (x) => x.map(() => x[Math.floor(r() * x.length)]), boots = [];
  for (let i = 0; i < 4000; i++) boots.push(mean(rs(b)) - mean(rs(a))); boots.sort((x, y) => x - y);
  return { point: mean(b) - mean(a), lo: boots[99], hi: boots[3899] }; }
function verdict(ci, better, n = 5) { if (n < 3) return "Too few runs yet"; if (ci.lo === 0 && ci.hi === 0) return "No difference";
  const good = better > 0 ? ci.lo > 0 : ci.hi < 0, bad = better > 0 ? ci.hi < 0 : ci.lo > 0;
  return bad ? "**Against**" : good ? "**Supported**" : better * ci.point > 0 ? "Weak (direction only)" : "None"; }
const D = (v) => `$${v.toFixed(3)}`, K = (v) => `${(v / 1000).toFixed(1)}K`, P = (v) => `${Math.round(v * 100)}%`, N = (v) => v.toFixed(1);
const sg = (f) => (d) => (d > 0 ? "+" : d < 0 ? "−" : "") + f(Math.abs(d));
function rescore(r) {
  try { const ts = fs.readFileSync(path.join(RUNS, r.id + ".log"), "utf8").split("#END").map(parseBlock).filter((b) => b.some((e) => e.type === "result")).map((b) => { const s = stats(b); return { all: s.all, text: s.final }; });
    return PROBES[r.probe].pass(ts, { created: r.created }) ? 1 : 0; } catch { return r.pass; } }
function writeReport(state, status) {
  const runs = Object.values(state.runs).map((r) => (r.exp === "E2" ? { ...r, pass: rescore(r) } : r)), total = REPS * (Object.keys(E1).length + Object.keys(PROBES).length * 2 + Object.keys(E3).length);
  const L = ["# GoalProof feature evidence", "", `**Status:** ${runs.length} of ${total} runs done${status ? ". " + status : ""}. Updated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.`, ""];
  const e1 = (arm) => runs.filter((r) => r.exp === "E1" && r.arm === arm).map((r) => ({ ...r, ...logStats(r.id) })), vals = (rs, k) => rs.map((r) => r[k]).filter((v) => v != null);
  if (runs.some((r) => r.exp === "E1")) {
    L.push("## E1: what a plan review costs, and what it finds", "",
      "The same plan, with 5 planted gaps, is reviewed five ways. Then the plan is revised and reviewed a second time. Main session: Sonnet, medium effort; every subagent runs on Sonnet too, so only the method differs.", "",
      "| Method | Runs | Review cost | Second-review cost | Total | Subagent tokens (first review) | Subagent used | Second review | Gaps found (of 5) | Told the user which agent and model |", "|---|---|---|---|---|---|---|---|---|---|");
    for (const arm of Object.keys(E1)) { const rs = e1(arm); if (!rs.length) continue;
      const m = (k, f) => { const v = vals(rs, k); return v.length ? f(mean(v)) : "–"; };
      const used = arm === "self" ? "none" : [...new Set(rs.flatMap((r) => r.types1 ?? []))].join(", ") || "none";
      const how = arm === "self" ? "same agent" : `${rs.filter((r) => r.resumes2 > 0).length} continued / ${rs.filter((r) => r.spawns2 > 0).length} new`;
      L.push(`| ${E1[arm].label} | ${rs.length} | ${m("cost1", D)} | ${m("cost2", D)} | ${m("cost", D)} | ${m("sub1", K)} | ${used} | ${how} | ${m("gaps", N)} | ${m("told", P)} |`); }
    const table = (a, b, head, rows) => { if (!e1(a).length || !e1(b).length) return; L.push("", `| Comparison | ${head[0]} | ${head[1]} | Change [95% CI] | Evidence |`, "|---|---|---|---|---|");
      for (const [k, f, better, label] of rows) { const x = vals(e1(a), k), y = vals(e1(b), k); if (!x.length || !y.length) continue;
        const ci = diffCI(x, y); L.push(`| ${label} | ${f(mean(x))} | ${f(mean(y))} | ${sg(f)(ci.point)} [${sg(f)(ci.lo)}, ${sg(f)(ci.hi)}]${(k.startsWith("cost") || k.startsWith("sub")) && mean(x) > 0 ? ` (${ci.point >= 0 ? "+" : "−"}${Math.round(Math.abs(ci.point) / mean(x) * 100)}%)` : ""} | ${verdict(ci, better, Math.min(x.length, y.length))} |`); } };
    const R = [["cost1", D, -1, "Review cost"], ["cost2", D, -1, "Second-review cost"], ["cost", D, -1, "Total cost"], ["sub1", K, -1, "Subagent tokens (first review)"], ["gaps", N, 1, "Gaps found (of 5)"]];
    L.push("", "**Does Claude follow GoalProof on its own?** Same neutral prompt (\"have a subagent review this plan\"); only the instruction files differ.");
    table("base", "goalproof", ["Without GoalProof", "With GoalProof"], [...R, ["told", P, 1, "Told the user which agent and model"]]);
    L.push("", "**The mechanism:** a default subagent given the pasted plan vs. GoalProof's judge pointed at PLAN.md, both named in the prompt.");
    table("default", "judge", ["Default subagent", "GoalProof judge"], R);
    L.push("", "**What independence costs:** the main agent reviewing alone vs. the judge.");
    table("self", "judge", ["Main agent alone", "GoalProof judge"], [["cost", D, -1, "Total cost"], ["gaps", N, 1, "Gaps found (of 5)"]]);
  }
  if (runs.some((r) => r.exp === "E2")) {
    L.push("", "## E2: does the agent do what GoalProof says?", "", "Each probe is a fixed prompt, run 5 times with and without GoalProof. A run passes when the agent shows the behaviour (rules below).", "",
      "| Probe | GoalProof feature | Without | With | Change [95% CI] | Evidence |", "|---|---|---|---|---|---|");
    for (const [k, Pr] of Object.entries(PROBES)) { const a = runs.filter((r) => r.probe === k && r.arm === "A_baseline").map((r) => r.pass), b = runs.filter((r) => r.probe === k && r.arm === "B_goalproof").map((r) => r.pass);
      if (!a.length || !b.length) continue; const ci = diffCI(a, b);
      L.push(`| ${k} | ${Pr.feature} | ${P(mean(a))} (${a.length}) | ${P(mean(b))} (${b.length}) | ${sg((v) => Math.round(v * 100) + " pts")(ci.point)} [${sg((v) => Math.round(v * 100) + " pts")(ci.lo)}, ${sg((v) => Math.round(v * 100) + " pts")(ci.hi)}] | ${verdict(ci, 1, Math.min(a.length, b.length))} |`); }
  }
  if (runs.some((r) => r.exp === "E3")) {
    L.push("", "## E3: does it suggest the model and effort? (GoalProof only, after the suggestion change)", "", "| Situation | Check | Rate |", "|---|---|---|");
    for (const [k, Pr] of Object.entries(E3)) { const rs = runs.filter((r) => r.exp === "E3" && r.probe === k); if (!rs.length) continue;
      for (const c of Object.keys(rs[0].score)) L.push(`| ${Pr.label} | ${E3_CHECKS[c] ?? c} | ${P(mean(rs.map((r) => r.score[c])))} (${rs.length} runs) |`); }
  }
  L.push("", "## How each result is measured", "",
    "- **Review cost:** Claude Code's reported cost for the whole turn (main agent plus any subagent), API list-price equivalent.",
    "- **Subagent tokens:** the subagent's own token count as Claude Code reports it in the Agent tool's result. Most of it is fixed start-up context: the subagent's system prompt, tool definitions, instruction files, and brief.",
    "- **Told the user:** the reply names the subagent (judge, general-purpose, or \"subagent\") and the model it ran on.",
    "- **Gaps found:** a Haiku grader compares each review with the 5 planted gaps (duplicates, a forbidden dependency, rejected-row reporting, build order, an untested performance criterion). The same grader scores every method.",
    "- **Second review:** after the revision, did the method continue the same subagent (SendMessage) or start a new one?",
    "- **Probes:** `understand` passes when the agent asks questions and creates no code files; `model` when it asks which model or tier to use before writing code; `rule` when, after the same correction twice, it proposes an instruction-file, editorconfig, or lint rule; `rigor` when it says the evidence is not enough and recommends at least two of: more examples, repeated runs, a held-out set, a noise or significance estimate.",
    "- **Evidence:** *Supported* when the 95% bootstrap CI excludes zero in GoalProof's favour; *Weak* when it is better on average but the CI includes zero; *Against* when the CI excludes zero the other way.",
    "", "## Caveats", "", "- Small, self-written test cases, one model (Sonnet), 5 runs per cell.", "- The probes check that a behaviour happens, not that it helps; the convergence test (`REPORT-conv2.md`) measures outcomes.");
  save(REPORT, L.join("\n") + "\n");
}

// ---------- main ----------
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { runs: {}, errors: {} }; } };
const waitMs = (msg) => { const m = msg.match(/\|(\d{10})\b/); if (m) { const ms = +m[1] * 1000 - Date.now() + 120000; if (ms > 0 && ms < 8 * 864e5) return ms; } return 15 * 60000; };
async function sleepChecked(ms) { const end = Date.now() + ms; while (Date.now() < end) { if (fs.existsSync(STOP)) return false; await new Promise((r) => setTimeout(r, Math.min(60000, end - Date.now()))); } return true; }
const mode = process.argv[2] ?? "report";
if (mode === "stop") { fs.writeFileSync(STOP, "stop"); console.log("Stop requested."); }
else if (mode === "report") { writeReport(loadState(), ""); console.log("wrote " + REPORT); }
else if (mode === "run") {
  if (fs.existsSync(LOCK)) { const pid = +fs.readFileSync(LOCK, "utf8"); try { process.kill(pid, 0); console.log("Already running (pid " + pid + ")."); process.exit(0); } catch {} }
  fs.writeFileSync(LOCK, String(process.pid)); process.on("exit", () => { try { fs.rmSync(LOCK); } catch {} });
  fs.rmSync(STOP, { force: true });
  const state = loadState(); state.errors ??= {};
  const saveState = () => save(STATE, JSON.stringify(state, null, 1));
  const order = [];
  for (let rep = 1; rep <= REPS; rep++) { for (const arm of Object.keys(E1)) order.push({ id: `E1-${arm}-r${rep}`, rep, go: () => runE1(arm, rep) });
    for (const probe of Object.keys(PROBES)) for (const arm of ["A_baseline", "B_goalproof"]) order.push({ id: `E2-${probe}-${arm}-r${rep}`, rep, go: () => runE2(probe, arm, rep) });
    for (const probe of Object.keys(E3)) order.push({ id: `E3-${probe}-r${rep}`, rep, go: () => runE3(probe, rep) }); }
  let stopped = false;
  for (const o of order) {
    if (fs.existsSync(STOP)) { stopped = true; break; }
    if (!state.runs[o.id] && (state.errors[o.id] ?? 0) < 3) {
      for (;;) {
        try { log("start " + o.id); writeReport(state, "Running " + o.id); state.runs[o.id] = await o.go(); log("done " + o.id); break; }
        catch (e) {
          if (e instanceof LimitError) { const ms = waitMs(e.message); const until = new Date(Date.now() + ms).toISOString().slice(0, 16);
            log(`usage limit during ${o.id}; waiting until ${until} UTC`); writeReport(state, `Paused by the usage limit; retrying ${o.id} from scratch around ${until} UTC`);
            if (!(await sleepChecked(ms))) { stopped = true; break; } continue; }
          state.errors[o.id] = (state.errors[o.id] ?? 0) + 1; saveState(); log(`error ${o.id} (#${state.errors[o.id]}): ${e.message}`);
          if (state.errors[o.id] >= 3 || !(await sleepChecked(60000))) break;
        }
      }
      saveState(); writeReport(state, "");
    }
    if (stopped) break;
    if (o === order.filter((x) => x.rep === 1).at(-1)) { const missing = order.filter((x) => x.rep === 1 && !state.runs[x.id]).map((x) => x.id);
      if (missing.length) { log("HALTED: " + missing.join(", ")); writeReport(state, "HALTED after the first round: " + missing.join(", ") + " failed; see suite/progress.log"); process.exitCode = 3; break; } }
  }
  if (stopped) { writeReport(state, "Stopped by request"); process.exitCode = 3; }
  else if (process.exitCode !== 3) { log("complete"); writeReport(state, "Complete"); }
}
