// GoalProof verification core. Agent-independent: any agent adapter, a git hook, or CI calls these functions.
// It decides what "done" needs from the project itself (its checks), not from what the agent says.
// No dependencies; Node 18+.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const DIR = ".goalproof";
// Files whose changes don't need a run: notes, docs, repo metadata, and GoalProof's own state.
export const NO_RUN_NEEDED = /(\.(md|markdown|txt|rst|adoc|log|csv)$)|(^|[\\/])(\.gitignore|\.gitattributes|LICENSE|CODEOWNERS)$|(^|[\\/])\.goalproof[\\/]/i;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", "target", ".venv", "venv", "__pycache__", ".next", ".goalproof"]);
const NPM_PLACEHOLDER = /no test specified/i;

const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };
const readJson = (p) => { const t = read(p); if (t === null) return null; try { return JSON.parse(t); } catch { return null; } };
const writeJson = (root, name, data) => {
  const dir = path.join(root, DIR); fs.mkdirSync(dir, { recursive: true });
  const gi = path.join(dir, ".gitignore"); if (!fs.existsSync(gi)) fs.writeFileSync(gi, "evidence.json\nstate.json\n");
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2) + "\n");
};

export function projectRoot(dir) {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: dir, encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() ? path.resolve(r.stdout.trim()) : path.resolve(dir);
}

// .goalproof/checks.json: { "checks": [{ "name": "tests", "run": "npm test", "timeout": 300 }], "onStop": "run" | "remind" | "off", "maxRetries": 1 }
export const loadConfig = (root) => readJson(path.join(root, DIR, "checks.json")) ?? {};

// Declared checks win; otherwise detect the usual test command for the project type.
export function findChecks(root, cfg = loadConfig(root)) {
  if (Array.isArray(cfg.checks) && cfg.checks.length) return cfg.checks.filter((c) => c && c.run).map((c, i) => ({ name: c.name ?? `check ${i + 1}`, run: c.run, timeout: c.timeout ?? 300 }));
  const has = (f) => fs.existsSync(path.join(root, f));
  const pkg = readJson(path.join(root, "package.json"));
  if (pkg?.scripts?.test && !NPM_PLACEHOLDER.test(pkg.scripts.test)) return [{ name: "tests", run: "npm test", timeout: 300 }];
  if (has("pytest.ini") || has("conftest.py") || (has("pyproject.toml") && /pytest/.test(read(path.join(root, "pyproject.toml")) ?? ""))) return [{ name: "tests", run: "python -m pytest -q", timeout: 300 }];
  if (has("go.mod")) return [{ name: "tests", run: "go test ./...", timeout: 300 }];
  if (has("Cargo.toml")) return [{ name: "tests", run: "cargo test", timeout: 600 }];
  if (has("Makefile") && /^test\s*:/m.test(read(path.join(root, "Makefile")) ?? "")) return [{ name: "tests", run: "make test", timeout: 300 }];
  return [];
}

// Code files of the project: tracked and untracked-but-not-ignored when it's a git repo, otherwise a filtered walk.
export function codeFiles(root) {
  const r = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let files;
  if (r.status === 0) files = r.stdout.split("\0").filter(Boolean);
  else {
    files = [];
    const walk = (rel) => {
      for (const d of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
        if (files.length > 20000) return;
        const p = rel ? `${rel}/${d.name}` : d.name;
        if (d.isDirectory()) { if (!SKIP_DIRS.has(d.name) && !d.name.startsWith(".")) walk(p); } else files.push(p);
      }
    };
    walk("");
  }
  return files.filter((f) => !NO_RUN_NEEDED.test(f)).sort();
}

// Fast fingerprint: path, size, and modification time of every code file. Changes when code changes; docs don't count.
export function fingerprint(root) {
  const h = crypto.createHash("sha1");
  for (const f of codeFiles(root)) {
    try { const s = fs.statSync(path.join(root, f)); h.update(`${f}\0${s.size}\0${Math.round(s.mtimeMs)}\n`); } catch { h.update(`${f}\0gone\n`); }
  }
  return h.digest("hex");
}

const tail = (s, lines = 25, chars = 2500) => { const t = String(s ?? "").trimEnd().split(/\r?\n/).slice(-lines).join("\n"); return t.length > chars ? t.slice(-chars) : t; };

export function runChecks(root, checks) {
  const results = checks.map((c) => {
    const t0 = Date.now();
    const r = spawnSync(c.run, { cwd: root, shell: true, encoding: "utf8", timeout: (c.timeout ?? 300) * 1000, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, CI: process.env.CI ?? "1" } });
    const timedOut = r.error?.code === "ETIMEDOUT";
    return { name: c.name, run: c.run, exitCode: timedOut ? null : r.status, timedOut, ms: Date.now() - t0, output: tail(`${r.stdout ?? ""}\n${r.stderr ?? ""}`) };
  });
  return { passed: results.length > 0 && results.every((x) => x.exitCode === 0), results };
}

// Success criteria from PLAN.md ("## Success criteria" bullets); "check: <name>" links a criterion to a check.
export function criteriaTrace(root, results = []) {
  const plan = read(path.join(root, "PLAN.md"));
  if (!plan) return [];
  const sec = plan.split(/\r?\n(?=#{1,3}\s)/).find((s) => /^#{1,3}\s+success criteria/i.test(s.trim()));
  if (!sec) return [];
  return sec.split(/\r?\n/).filter((l) => /^\s*[-*]\s/.test(l)).map((l) => {
    const text = l.replace(/^\s*[-*]\s+(\[[ xX]\]\s+)?/, "").split(/\s+·\s+/)[0].trim();
    const name = (l.match(/check:\s*`?([^`·]+?)`?\s*(·|$)/i)?.[1] ?? "").trim();
    const r = results.find((x) => name && (x.name === name || x.run === name));
    return { criterion: text, check: name || null, status: !name ? "no check" : !r ? "check not found" : r.exitCode === 0 ? "passed" : "failed" };
  });
}

export const readEvidence = (root) => readJson(path.join(root, DIR, "evidence.json"));
const readState = (root) => readJson(path.join(root, DIR, "state.json")) ?? {};

// Run the checks now and record the evidence (used by the CLI, git hooks, CI, and the stop decision).
export function verify(root) {
  const checks = findChecks(root), fp = fingerprint(root);
  const run = checks.length ? runChecks(root, checks) : { passed: false, results: [] };
  const evidence = { version: 1, time: new Date().toISOString(), fingerprint: fp, checksFound: checks.length > 0, passed: run.passed, checks: run.results, criteria: criteriaTrace(root, run.results) };
  if (checks.length) writeJson(root, "evidence.json", evidence);
  return evidence;
}

// Called when the user sends a prompt: remembers the code state, so the stop decision knows what this turn changed.
export function markTurn(root) {
  writeJson(root, "state.json", { ...readState(root), turnStart: fingerprint(root), markedAt: new Date().toISOString(), retries: 0 });
}

const fmtSecs = (ms) => `${(ms / 1000).toFixed(1)} s`;
export function summary(ev) {
  if (!ev.checksFound) return "no checks found";
  const parts = ev.checks.map((c) => `${c.run} ${c.exitCode === 0 ? "passed" : c.timedOut ? "timed out" : `failed (exit ${c.exitCode})`} in ${fmtSecs(c.ms)}`);
  const open = ev.criteria.filter((c) => c.status !== "passed");
  const crit = ev.criteria.length ? `; success criteria with passing checks: ${ev.criteria.length - open.length} of ${ev.criteria.length}` + (open.length ? ` (not covered: ${open.map((c) => `"${c.criterion}"`).join(", ")})` : "") : "";
  return parts.join("; ") + crit;
}

// The stop decision. Returns { action: "allow" | "block", message?, reason? }.
// - nothing changed this turn, or the current code already has passing evidence: allow
// - checks exist (mode "run"): run them; pass -> allow and tell the user; fail -> send the agent back once with the output
// - no checks (or mode "remind"): send the agent back once to run the code or say why it can't, unless the adapter knows it already did
export function decideStop(root, { retrying = false, ranCode = false, saidUnverified = false } = {}) {
  const cfg = loadConfig(root), mode = cfg.onStop ?? "run", maxRetries = cfg.maxRetries ?? 1;
  if (mode === "off") return { action: "allow" };
  const fp = fingerprint(root), state = readState(root), ev = readEvidence(root);
  const changed = state.turnStart ? fp !== state.turnStart : ev ? fp !== ev.fingerprint : false;
  if (!changed || (ev && ev.fingerprint === fp && ev.passed)) return { action: "allow" };
  const retries = state.retries ?? 0, canBlock = !retrying || retries < maxRetries;
  const checks = findChecks(root, cfg);
  if (checks.length && mode === "run") {
    const e = verify(root);
    if (e.passed) return { action: "allow", message: `GoalProof verified: ${summary(e)}.` };
    if (!canBlock) return { action: "allow", message: `GoalProof: the checks still fail after ${retries} retr${retries === 1 ? "y" : "ies"}: ${summary(e)}. Review before relying on this change.` };
    writeJson(root, "state.json", { ...state, retries: retries + 1 });
    const failed = e.checks.filter((c) => c.exitCode !== 0);
    return { action: "block", reason: `GoalProof ran the project's checks after your changes, and they failed.\n${failed.map((c) => `$ ${c.run}  (${c.timedOut ? "timed out" : `exit ${c.exitCode}`})\n${c.output}`).join("\n\n")}\n\nFix the cause and finish again. If the failure is unrelated to your change or can't be fixed here, say so and why in your reply.` };
  }
  if (ranCode || saidUnverified || !canBlock) return { action: "allow" };
  writeJson(root, "state.json", { ...state, retries: retries + 1 });
  return { action: "block", reason: "GoalProof check: this turn changed code, and no automatic checks were found for this project (add .goalproof/checks.json so GoalProof can run them). Run the tests or the code now and report the result. If running it isn't possible here, say so and why in your reply." };
}
