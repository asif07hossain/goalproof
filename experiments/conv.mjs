// Convergence test for the GoalProof: how many tries, and how much cost and time,
// until an agent reaches a correct solution, with and without GoalProof.
// Usage: node conv.mjs selftest | run | report | stop
// "run" is resumable: finished runs are kept in conv/state.json; a run cut off by a usage
// limit is discarded and redone after the limit resets.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTNAME = process.env.CONV_OUT || "conv", OUT = path.join(ROOT, OUTNAME), RUNS = path.join(OUT, "runs"), SIM = path.join(OUT, "sim");
const STATE = path.join(OUT, "state.json"), REPORT = path.join(ROOT, OUTNAME === "conv" ? "REPORT.md" : `REPORT-${OUTNAME}.md`), LOCK = path.join(OUT, "lock");
const STOP = path.join(OUT, "STOP"), PROGRESS = path.join(OUT, "progress.log");
const GRADER = path.join(OUT, "grader.mjs"), BASE = path.join(OUT, "baseline-settings.json");
const MODEL = ["--model", "sonnet", "--effort", "medium"];
const REPS = 5, MAX_HUMAN_TURNS = 5;
const ARMS = { A_baseline: ["--settings", BASE], B_playbook: [] };
for (const d of [OUT, RUNS, SIM]) fs.mkdirSync(d, { recursive: true });

// ---------- tasks ----------
const PKG = JSON.stringify({ name: "toy", type: "module", scripts: { test: "node --test" } }, null, 2);
const J = (c, e) => ({ c, e, j: 1 }), T = (c, e) => ({ c, e }), THROWS = (c) => ({ c, t: 1 }), APPROX = (c, e) => ({ c, e, a: 1 });
const testFile = (names, body) => `import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { ${names} } from "../src/text.js";\n\n${body}`;
const PARSE_REF = `export function parseDuration(text) {
  if (typeof text !== "string") throw new Error("not a string");
  const t = text.trim().toLowerCase();
  if (!t) throw new Error("empty");
  if (/^\\d+(\\.\\d+)?$/.test(t)) return Number(t);
  const U = { d: 86400, h: 3600, m: 60, s: 1 }, re = /(\\d+(?:\\.\\d+)?)\\s*([dhms])\\s*/y;
  let total = 0, i = 0;
  while (i < t.length) { re.lastIndex = i; const m = re.exec(t); if (!m) throw new Error("bad duration"); total += Number(m[1]) * U[m[2]]; i = re.lastIndex; }
  return total;
}
`;
const FORMAT_REF = `
export function formatDuration(sec) {
  if (sec === 0) return "0s";
  let out = "", r = sec;
  for (const [u, n] of [["d", 86400], ["h", 3600], ["m", 60], ["s", 1]]) { const q = Math.floor(r / n); if (q) { out += q + u; r -= q * n; } }
  return out;
}
`;
const T3_SRC = `// Normalizes user text before comparing or formatting it.
export function clean(s) {
  return s.trim().toLowerCase();
}

export function slugify(title) {
  return clean(title).replace(/\\s+/g, "-");
}

export function sameWord(a, b) {
  return clean(a) === clean(b);
}
`;
const T4_SRC = `import fs from "node:fs";

export function loadSales(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function average(rows) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return total / rows.length;
}
`;
// Held-out tasks: written after GoalProof fixes and never used to tune it.
const CSV_REF = `export function parseCsvLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) { const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; }
  out.push(cur); return out;
}
`;
const DEDUPE_SRC = "export function dedupeEmails(list) {\n  return [...new Set(list)];\n}\n";
const HELD = [
  { key: "H1", files: { "package.json": PKG, "src/csv.js": "// CSV helpers.\n" },
    phases: [{ key: "H1", mod: "src/csv.js",
      prompt: "Add `parseCsvLine(line)` to src/csv.js. It splits one line of a CSV file into an array of fields.",
      spec: "Standard CSV rules for one line: fields are separated by commas; a field in double quotes can contain commas; two double quotes inside a quoted field mean one literal quote; empty fields are kept, including a trailing one; spaces are kept as they are; an empty line gives one empty field.",
      cases: [J("parseCsvLine('a,b,c')", ["a", "b", "c"]), J("parseCsvLine('\"a,b\",c')", ["a,b", "c"]), J("parseCsvLine('\"say \"\"hi\"\"\",x')", ['say "hi"', "x"]),
        J("parseCsvLine('a,,b')", ["a", "", "b"]), J("parseCsvLine('a,b,')", ["a", "b", ""]), J("parseCsvLine(' a , b ')", [" a ", " b "]), J("parseCsvLine('')", [""])],
      ref: { "src/csv.js": CSV_REF } }] },
  { key: "H2", files: { "package.json": PKG, "src/users.js": DEDUPE_SRC,
      "test/users.test.js": 'import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { dedupeEmails } from "../src/users.js";\n\ntest("exact duplicates", () => assert.deepEqual(dedupeEmails(["a@x.com", "a@x.com"]), ["a@x.com"]));\n' },
    phases: [{ key: "H2", mod: "src/users.js",
      prompt: "`dedupeEmails` in src/users.js still returns duplicates: `dedupeEmails(['Ann@x.com', 'ann@x.com'])` returns both. Fix it.",
      spec: "Emails are compared ignoring letter case and surrounding spaces. Keep the first occurrence of each address, trimmed but with its original letter case, in the original order. Don't change the input array.",
      cases: [J("dedupeEmails(['Ann@x.com', 'ann@x.com'])", ["Ann@x.com"]), J("dedupeEmails([' bob@y.com', 'BOB@y.com '])", ["bob@y.com"]),
        J("dedupeEmails(['a@x.com', 'b@x.com', 'A@X.COM'])", ["a@x.com", "b@x.com"]), J("dedupeEmails([])", []),
        T("(() => { const a = ['A@x.com', 'a@x.com']; dedupeEmails(a); return a.length; })()", 2), J("dedupeEmails(['a@x.com', 'a@x.com'])", ["a@x.com"])],
      ref: { "src/users.js": "export function dedupeEmails(list) {\n  const seen = new Set(), out = [];\n  for (const e of list) { const t = e.trim(), k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(t); } }\n  return out;\n}\n" } }] },
];
const LIST = "[{ amount: 500, category: 'food', date: '2026-01-05' }, { amount: 1000, category: 'rent', date: '2026-01-01' }, { amount: 250, category: 'food', date: '2026-02-03' }]";
const L1_REF = `const DATE = /^\\d{4}-\\d{2}-\\d{2}$/;
export function addExpense(list, e) {
  if (!Array.isArray(list) || !e || !Number.isInteger(e.amount) || e.amount < 0 || typeof e.category !== "string" || !e.category || typeof e.date !== "string" || !DATE.test(e.date)) throw new Error("invalid expense");
  return [...list, { ...e }];
}
`;
const L2_REF = L1_REF + `
export function sortByDate(list) {
  if (!Array.isArray(list)) throw new Error("not a list");
  return [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
`;
const L3_REF = L2_REF + `
export function monthlyTotals(list, month) {
  if (!Array.isArray(list) || typeof month !== "string" || !/^\\d{4}-\\d{2}$/.test(month)) throw new Error("invalid input");
  const out = {};
  for (const e of list) if (e.date.startsWith(month + "-")) out[e.category] = (out[e.category] ?? 0) + e.amount;
  return out;
}
`;
const L4_REF = L3_REF + `
export function formatAmount(amount) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("invalid amount");
  return "$" + Math.floor(amount / 100) + "." + String(amount % 100).padStart(2, "0");
}
`;
const CONVENTIONS = "Project conventions: amounts are whole numbers of cents; functions never modify their input arrays or objects; invalid input throws an Error.";
const LONGTASK = { key: "L", files: { "package.json": PKG, "src/expenses.js": "// Expense helpers.\n" },
  phases: [
    { key: "L1", mod: "src/expenses.js",
      prompt: "We're building a small expense library in src/expenses.js over several sessions. " + CONVENTIONS + " Today: add `addExpense(list, expense)`, which returns a new list with the expense added. An expense is `{ amount, category, date }`, with the date as 'YYYY-MM-DD'.",
      spec: CONVENTIONS + " addExpense rejects a negative or non-integer amount, an empty category, and a date that isn't 'YYYY-MM-DD'. Zero is allowed.",
      cases: [T("addExpense([], { amount: 500, category: 'food', date: '2026-01-05' }).length", 1), T("(() => { const a = []; addExpense(a, { amount: 500, category: 'food', date: '2026-01-05' }); return a.length; })()", 0),
        THROWS("addExpense([], { amount: -5, category: 'food', date: '2026-01-05' })"), THROWS("addExpense([], { amount: 5.5, category: 'food', date: '2026-01-05' })"),
        THROWS("addExpense([], { amount: 5, category: '', date: '2026-01-05' })"), THROWS("addExpense([], { amount: 5, category: 'food', date: 'Jan 5' })")],
      ref: { "src/expenses.js": L1_REF } },
    { key: "L2", mod: "src/expenses.js", prompt: "Continue the expense library from last session: add `sortByDate(list)`, which returns the expenses sorted by date, oldest first.",
      spec: "sortByDate returns a new array sorted by date, oldest first. Project conventions apply: don't modify the input, and throw an Error if the list isn't an array.",
      cases: [J("sortByDate(" + LIST + ").map((e) => e.date)", ["2026-01-01", "2026-01-05", "2026-02-03"]), T("(() => { const a = " + LIST + "; sortByDate(a); return a[0].date; })()", "2026-01-05"),
        THROWS("sortByDate(null)"), THROWS("addExpense([], { amount: -5, category: 'food', date: '2026-01-05' })")],
      ref: { "src/expenses.js": L2_REF } },
    { key: "L3", mod: "src/expenses.js", prompt: "Continue the expense library: add `monthlyTotals(list, month)`, which returns the total per category for one month.",
      spec: "monthlyTotals takes the month as 'YYYY-MM' and returns an object mapping each category to its total in cents for that month only; categories with nothing that month are left out. A month in any other format throws an Error. The input isn't modified.",
      cases: [J("monthlyTotals(" + LIST + ", '2026-01')", { food: 500, rent: 1000 }), J("monthlyTotals(" + LIST + ", '2026-03')", {}), THROWS("monthlyTotals(" + LIST + ", 'January')"),
        T("(() => { const a = " + LIST + "; monthlyTotals(a, '2026-01'); return a.length; })()", 3), J("sortByDate(" + LIST + ").map((e) => e.date)", ["2026-01-01", "2026-01-05", "2026-02-03"])],
      ref: { "src/expenses.js": L3_REF } },
    { key: "L4", mod: "src/expenses.js", prompt: "Continue the expense library: add `formatAmount(amount)` for displaying an amount, like \"$12.50\".",
      spec: "formatAmount takes a whole number of cents and returns a string like '$12.50': a dollar sign, the dollars with no thousands separators, a dot, and two digits of cents. Negative or non-integer input throws an Error.",
      cases: [T("formatAmount(1250)", "$12.50"), T("formatAmount(5)", "$0.05"), T("formatAmount(100000)", "$1000.00"), THROWS("formatAmount(12.5)"), THROWS("formatAmount(-1)"),
        J("monthlyTotals(" + LIST + ", '2026-02')", { food: 250 })],
      ref: { "src/expenses.js": L4_REF } }] };
const TASKS = [
  { key: "T1", files: { "package.json": PKG, "src/text.js": "export function capitalize(s) {\n  return s[0].toUpperCase() + s.slice(0);\n}\n",
      "test/text.test.js": testFile("capitalize", 'test("capitalize", () => assert.equal(capitalize("hello"), "Hello"));\n') },
    phases: [{ key: "T1", mod: "src/text.js",
      prompt: '`capitalize` in src/text.js returns "Hhello" for "hello". It should uppercase only the first letter. Fix it.',
      spec: "capitalize uppercases the first character and leaves the rest of the string unchanged.",
      cases: [T("capitalize('hello')", "Hello"), T("capitalize('a')", "A"), T("capitalize('Hello')", "Hello"), T("capitalize('hello world')", "Hello world")],
      ref: { "src/text.js": "export function capitalize(s) {\n  return s[0].toUpperCase() + s.slice(1);\n}\n" } }] },
  { key: "T2", files: { "package.json": PKG, "src/duration.js": "// Duration helpers.\n" },
    phases: [{ key: "T2", mod: "src/duration.js",
      prompt: 'Add `parseDuration(text)` to src/duration.js. It converts strings like "1h30m" or "45s" into a number of seconds.',
      spec: 'Units are d (days), h, m and s. Letters are case-insensitive. Spaces between parts are allowed ("1h 30m"). Decimal numbers are allowed ("1.5h" is 5400). A plain number with no unit means seconds ("90" is 90). Empty strings, unknown units and other invalid input throw an Error.',
      cases: [T("parseDuration('1h30m')", 5400), T("parseDuration('45s')", 45), T("parseDuration('1h 30m')", 5400), T("parseDuration('1.5h')", 5400), T("parseDuration('2d')", 172800),
        T("parseDuration('2H')", 7200), T("parseDuration('90')", 90), THROWS("parseDuration('')"), THROWS("parseDuration('abc')"), THROWS("parseDuration('5x')")],
      ref: { "src/duration.js": PARSE_REF } }] },
  { key: "T3", files: { "package.json": PKG, "src/text.js": T3_SRC,
      "test/text.test.js": testFile("slugify, sameWord", 'test("slugify spaces", () => assert.equal(slugify("Hello World"), "hello-world"));\ntest("sameWord ignores case and spaces", () => assert.equal(sameWord(" Hi ", "hi"), true));\ntest("sameWord keeps symbols", () => assert.equal(sameWord("C++", "C"), false));\n') },
    phases: [{ key: "T3", mod: "src/text.js",
      prompt: '`slugify` in src/text.js keeps punctuation: `slugify("Hello, World!")` returns "hello,-world!" but should return "hello-world". Fix it.',
      spec: "Slugs contain only lowercase letters, digits and single hyphens, with no hyphen at the start or end. sameWord must keep its current behavior.",
      cases: [T("slugify('Hello, World!')", "hello-world"), T("slugify('  Rock & Roll  ')", "rock-roll"), T("slugify('Hello World')", "hello-world"), T("slugify('Already-Slugged')", "already-slugged"),
        T("sameWord(' Hi ', 'hi')", true), T("sameWord('C++', 'C')", false), T("sameWord(\"it's\", 'its')", false)],
      ref: { "src/text.js": T3_SRC.replace('replace(/\\s+/g, "-")', 'replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")') } }] },
  { key: "T4", files: { "package.json": PKG, "src/report.js": T4_SRC,
      "data/sales.json": JSON.stringify([{ id: 1, amount: 100 }, { id: 2, amount: "1,200.50" }, { id: 3, amount: 250 }, { id: 4, amount: "75.25" }, { id: 5, amount: 300 }], null, 2) },
    phases: [{ key: "T4", mod: "src/report.js",
      prompt: '`average(loadSales("data/sales.json"))` in src/report.js returns NaN. It should return the average sale amount. Fix it.',
      spec: 'Amounts can be numbers or strings, and strings can contain thousands separators, like "1,200.50". The average is over all rows.',
      cases: [APPROX("average(loadSales('data/sales.json'))", 385.15), T("average([{ amount: '2,000' }, { amount: 1000 }])", 1500), T("average([{ amount: 10 }])", 10), T("average([{ amount: '1,000,000' }, { amount: 0 }])", 500000)],
      ref: { "src/report.js": T4_SRC.replace("sum + row.amount", 'sum + Number(String(row.amount).replace(/,/g, ""))') } }] },
  { key: "T5", files: { "package.json": PKG, "src/duration.js": "// Duration helpers.\n" },
    phases: [
      { key: "T5a", mod: "src/duration.js",
        prompt: 'We\'re building duration helpers in src/duration.js over two sessions. Today: add `parseDuration(text)`, which turns strings like "1h30m", "2d4h" or "45s" into seconds (units d, h, m, s; throw an Error on anything else). Next session we\'ll add `formatDuration(seconds)`, the reverse: units in d, h, m, s order, skip zero units, no spaces, and 0 gives "0s". Only do parseDuration today.',
        spec: 'parseDuration takes whole numbers with units d, h, m, s, like "2d4h", and throws an Error on anything else.',
        cases: [T("parseDuration('1h30m')", 5400), T("parseDuration('2d4h')", 187200), T("parseDuration('45s')", 45), THROWS("parseDuration('abc')")],
        ref: { "src/duration.js": PARSE_REF } },
      { key: "T5b", mod: "src/duration.js", prompt: "Continue the duration work from last session.",
        spec: 'Add formatDuration(seconds), the reverse of parseDuration: units in d, h, m, s order, skip zero units, no spaces, and 0 gives "0s". parseDuration must keep working.',
        cases: [T("formatDuration(5400)", "1h30m"), T("formatDuration(86400)", "1d"), T("formatDuration(90)", "1m30s"), T("formatDuration(0)", "0s"), T("formatDuration(93784)", "1d2h3m4s"), T("parseDuration('2d4h')", 187200)],
        ref: { "src/duration.js": PARSE_REF + FORMAT_REF } }] },
  ...(OUTNAME === "conv" ? [] : [...HELD, LONGTASK]),
];
const ROWS = { T1: "Control: trivial, clearly described bug", T2: "Unclear spec with hidden requirements", T3: "Bug in shared code: the obvious fix breaks another function",
  T4: "Misleading symptom: the quick fix is silently wrong", T5a: "Two sessions, part 1", T5b: "Two sessions, part 2: a fresh session told to continue", H1: "Held-out: unclear spec (CSV line parser)", H2: "Held-out: vague bug report (email dedupe)", L1: "Long project, session 1: conventions stated", L2: "Long project, session 2 (fresh): sortByDate", L3: "Long project, session 3 (fresh): monthlyTotals", L4: "Long project, session 4 (fresh): formatAmount" };
const NONCTRL = ["T2", "T3", "T4", "T5a", "T5b"], HELDOUT = ["H1", "H2"], LONG = ["L1", "L2", "L3", "L4"];

// ---------- grader (runs in a child process; hidden checks never enter the run directory) ----------
fs.writeFileSync(GRADER, `import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [dir, mod, casesFile] = process.argv.slice(2);
process.chdir(dir);
const cases = JSON.parse(fs.readFileSync(casesFile, "utf8"));
const BT = String.fromCharCode(96);
const canon = (v) => JSON.stringify(v, (key, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
const show = (v) => typeof v === "string" ? JSON.stringify(v) : (typeof v === "number" || v === undefined) ? String(v) : JSON.stringify(v);
let m;
try { m = await import(pathToFileURL(path.join(dir, mod)).href); }
catch (e) { console.log(JSON.stringify({ loadError: String((e && e.message) || e).slice(0, 300) })); process.exit(0); }
const names = Object.keys(m).filter((n) => /^[A-Za-z_$][\\w$]*$/.test(n) && n !== "default");
const vals = names.map((n) => m[n]);
const results = cases.map((k) => {
  const call = BT + k.c + BT;
  const fn = (k.c.match(/^(\\w+)\\(/) || [])[1];
  if (fn && !names.includes(fn)) return { ok: false, msg: fn + " is not exported from " + mod + "." };
  try {
    const v = new Function(...names, "return (" + k.c + ");")(...vals);
    if (k.t) return { ok: false, msg: "I ran " + call + " and it returned " + show(v) + ", but I expected it to throw an error." };
    const ok = k.a ? Math.abs(v - k.e) < 1e-6 : k.j ? canon(v) === canon(k.e) : v === k.e;
    return { ok, msg: ok ? "" : "I ran " + call + " and got " + show(v) + ", but I expected " + show(k.e) + "." };
  } catch (e) {
    if (k.t) return { ok: true, msg: "" };
    return { ok: false, msg: "I ran " + call + " and it threw " + JSON.stringify(String((e && e.message) || e).slice(0, 200)) + ", but I expected " + show(k.e) + "." };
  }
});
console.log(JSON.stringify({ results }));
`);
fs.writeFileSync(BASE, JSON.stringify({
  claudeMdExcludes: ["**/.claude/CLAUDE.md", "**/.claude/AGENTS.md", ...["CLAUDE.md", "AGENTS.md"].map((n) => path.join(os.homedir(), ".claude", n).replace(/\\/g, "/"))],
  skillOverrides: { playbook: "off", "ai-experiment": "off" },
  permissions: { deny: ["Agent(judge)", "Agent(deep)"] },
  disableAllHooks: true,
}, null, 2));
const casesFile = (ph) => path.join(OUT, `cases-${ph.key}.json`);
for (const t of TASKS) for (const ph of t.phases) fs.writeFileSync(casesFile(ph), JSON.stringify(ph.cases));

function grade(dir, ph) {
  const r = spawnSync(process.execPath, [GRADER, dir, ph.mod, casesFile(ph)], { encoding: "utf8", timeout: 15000 });
  let out; try { out = JSON.parse((r.stdout || "").trim().split(/\r?\n/).pop()); } catch { out = { loadError: "the module crashed or hung: " + (r.stderr || "").slice(0, 200) }; }
  const total = ph.cases.length;
  if (out.loadError) return { pass: 0, total, ok: Array(total).fill(false), feedback: `Importing ${ph.mod} failed: ${out.loadError} Please fix it.` };
  const ok = out.results.map((x) => x.ok), first = out.results.find((x) => !x.ok);
  return { pass: ok.filter(Boolean).length, total, ok, feedback: first ? first.msg + " Please fix it." : null };
}

// ---------- helpers ----------
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function save(f, s) { for (let i = 0; ; i++) { try { fs.writeFileSync(f, s); return; } catch (e) { if (i >= 4) throw e; sleepSync(500); } } }
function log(msg) { try { fs.appendFileSync(PROGRESS, `${new Date().toISOString()} ${msg}\n`); } catch {} console.log(msg); }
function writeTree(dir, files) { for (const [rel, body] of Object.entries(files)) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); } }
function srcHash(dir) { // code files only, so writing PLAN.md or LOG.md doesn't count as an edit
  const h = crypto.createHash("sha1");
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (f.name.startsWith(".") || f.name === "node_modules") continue; const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p); else if (!/\.md$/i.test(f.name)) { h.update(p); h.update(fs.readFileSync(p)); } } };
  walk(dir); return h.digest("hex");
}
const cmpVer = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 4; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0); return 0; };
function findCli() { // CLAUDE_BIN if set, else the newest Claude Code VS Code extension binary, else `claude` on PATH
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const ext = path.join(os.homedir(), ".vscode", "extensions");
  const dirs = (fs.existsSync(ext) ? fs.readdirSync(ext) : []).map((d) => [d, d.match(/^anthropic\.claude-code-([\d.]+)/)?.[1]]).filter((x) => x[1]).sort((a, b) => cmpVer(b[1], a[1]));
  for (const [d] of dirs) for (const b of ["claude.exe", "claude"]) { const p = path.join(ext, d, "resources", "native-binary", b); if (fs.existsSync(p)) return p; }
  return "claude";
}
function cli(args, cwd) {
  return new Promise((res) => {
    let out = "", err = "", done = false; const finish = (code) => { if (!done) { done = true; clearTimeout(t); res({ code, out, err }); } };
    const child = spawn(findCli(), args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (err += d));
    const t = setTimeout(() => child.kill(), 10 * 60 * 1000);
    child.on("close", finish); child.on("error", (e) => { err += String(e); finish(-1); });
  });
}
class LimitError extends Error {}
const LIMIT_RE = /usage limit|limit reached|hit your (usage )?limit|out of (extra )?usage|rate.?limit|overloaded/i;
async function claudeTurn(cwd, prompt, extra, logFile) {
  const r = await cli(["-p", prompt, "--output-format", "stream-json", "--verbose", ...extra], cwd);
  fs.appendFileSync(logFile, `#PROMPT ${prompt}\n${r.out}${r.err ? "#STDERR " + r.err + "\n" : ""}#END\n`);
  const ev = r.out.split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const res = ev.filter((e) => e.type === "result").at(-1);
  const limitText = /usage limit|hit your (usage )?limit|out of extra usage/i.test(res?.result ?? "") && !(res?.total_cost_usd > 0);
  if (!res || res.is_error || limitText) {
    const blob = (res ? JSON.stringify(res) : "") + r.out.slice(-1500) + r.err.slice(-1500);
    if (LIMIT_RE.test(blob)) throw new LimitError(blob.slice(0, 400));
    throw new Error(`turn failed (exit ${r.code}): ${blob.slice(0, 400)}`);
  }
  let subagents = 0; const tools = [], texts = [];
  for (const e of ev) if (e.type === "assistant" && !e.parent_tool_use_id) for (const b of e.message?.content ?? []) { if (b.type === "tool_use") tools.push({ name: b.name, cmd: String(b.input?.command ?? "") }); if (b.type === "text") texts.push(b.text); }
  subagents = tools.filter((x) => /^(Agent|Task)$/.test(x.name)).length;
  const u = res.usage ?? {};
  return { tools, allText: texts.join("\n") + "\n" + (res.result ?? ""), sessionId: res.session_id, text: res.result ?? "", cost: res.total_cost_usd ?? 0, secs: (res.duration_ms ?? 0) / 1000, subagents,
    tokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.output_tokens ?? 0) };
}
const agentArgs = (arm, sid) => ["--permission-mode", "acceptEdits", "--allowedTools", "Bash(node *)", "Bash(npm test*)", "Bash(npm run test*)", ...MODEL, ...ARMS[arm], ...(sid ? ["--resume", sid] : [])];
const simPrompt = (spec, text) => `You are role-playing a user who asked a coding agent for a change. Your requirements, which the agent has not seen: ${spec} The agent replied: """${text.replace(/\s+/g, " ").slice(0, 3000)}""" Answer only the questions it asked, briefly, from your requirements. If your requirements don't cover a question, say it's the agent's choice. Don't mention requirements it didn't ask about. Reply with the answer only.`;

// ---------- one task phase: rounds until the hidden checks pass ----------
async function runPhase(dir, arm, ph, logFile) {
  const m = { checked: null, sized: false, suggested: false, plan: false, start: 0, firstTry: null, final: 0, solved: false, clarify: 0, corrections: 0, regressions: 0, cost: 0, simCost: 0, tokens: 0, secs: 0, subagents: 0, agentTurns: 0, trace: [] };
  const g0 = grade(dir, ph); m.start = g0.pass / g0.total;
  const passed = new Set(g0.ok.flatMap((ok, i) => (ok ? [i] : []))), regressed = new Set();
  let sid = null, prompt = ph.prompt, human = 0;
  for (;;) {
    const before = srcHash(dir);
    const t = await claudeTurn(dir, prompt, agentArgs(arm, sid), logFile);
    sid = t.sessionId; if (m.agentTurns === 0) { m.sized = /workflow:\s*(small|medium|large)|sized (this|it) as/i.test(t.allText); m.suggested = /\b(haiku|sonnet|opus|fable)\b|\b(low|medium|high|max) effort\b/i.test(t.allText); } m.agentTurns++; m.cost += t.cost; m.tokens += t.tokens; m.secs += t.secs; m.subagents += t.subagents;
    if (srcHash(dir) === before && t.text.includes("?") && human < MAX_HUMAN_TURNS) { // a question: the simulated user answers
      const a = await claudeTurn(SIM, simPrompt(ph.spec, t.text), ["--model", "haiku", "--settings", BASE, "--no-session-persistence"], logFile);
      m.simCost += a.cost; m.clarify++; human++; prompt = a.text.replace(/\s+/g, " ").trim() || "Your choice."; m.trace.push("Q"); continue;
    }
    const g = grade(dir, ph);
    if (m.firstTry === null) { m.firstTry = g.pass / g.total; const le = t.tools.reduce((a, x, i) => (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(x.name) ? i : a), -1); m.checked = t.tools.some((x, i) => i > le && x.name === "Bash" && /\bnode\b|\bnpm\b/.test(x.cmd)) ? 1 : 0; }
    g.ok.forEach((ok, i) => { if (ok) passed.add(i); else if (passed.has(i)) regressed.add(i); });
    m.regressions = regressed.size; m.final = g.pass / g.total; m.trace.push(`${g.pass}/${g.total}`);
    if (g.pass === g.total) { m.solved = true; break; }
    if (human >= MAX_HUMAN_TURNS) break;
    m.corrections++; human++; prompt = g.feedback;
  }
  m.plan = fs.existsSync(path.join(dir, "PLAN.md"));
  return m;
}
async function runOne(task, arm, rep) {
  const id = `${task.key}-${arm}-r${rep}`, dir = path.join(RUNS, id), logFile = path.join(RUNS, id + ".log");
  fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(logFile, { force: true }); writeTree(dir, task.files);
  const phases = {};
  for (const ph of task.phases) phases[ph.key] = await runPhase(dir, arm, ph, logFile); // each phase is a new session
  return { id, task: task.key, arm, rep, phases, finished: new Date().toISOString() };
}

// ---------- report ----------
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function diffCI(cells) { // mean over task rows of (GoalProof mean - baseline mean), bootstrapped within each cell
  const r = rng(42), boots = [], d = (f) => mean(cells.map((c) => mean(f(c.b)) - mean(f(c.a))));
  const rs = (a) => a.map(() => a[Math.floor(r() * a.length)]);
  for (let i = 0; i < 4000; i++) boots.push(d(rs));
  boots.sort((x, y) => x - y);
  return { point: d((a) => a), lo: boots[99], hi: boots[3899] };
}
const P = (v) => `${Math.round(v * 100)}%`, N = (v) => v.toFixed(1), D = (v) => `$${v.toFixed(3)}`, S = (v) => `${Math.round(v)} s`;
const sg = (f) => (d) => (d > 0 ? "+" : d < 0 ? "−" : "") + f(Math.abs(d)), PTS = (v) => `${Math.round(v * 100)} pts`;
const METRICS = [
  { claim: "More accurate", label: "First-attempt accuracy", better: 1, fmt: P, dfmt: sg(PTS), get: (m) => m.firstTry },
  { claim: "Fewer tries", label: "Human turns needed", better: -1, fmt: N, dfmt: sg(N), get: (m) => m.clarify + m.corrections },
  { claim: "Faster convergence", label: "Correction rounds", better: -1, fmt: N, dfmt: sg(N), get: (m) => m.corrections },
  { claim: "Solves more problems", label: "Solved within 5 human turns", better: 1, fmt: P, dfmt: sg(PTS), get: (m) => (m.solved ? 1 : 0) },
  { claim: "Breaks less working code", label: "Regressions", better: -1, fmt: N, dfmt: sg(N), get: (m) => m.regressions },
  { claim: "Lower total cost", label: "Agent cost until done", better: -1, fmt: D, dfmt: sg(D), rel: 1, get: (m) => m.cost },
  { claim: "Less time", label: "Agent time until done", better: -1, fmt: S, dfmt: sg(S), rel: 1, get: (m) => m.secs },
  { claim: "Checks its own work", label: "Ran the code or tests before handing over", better: 1, fmt: P, dfmt: sg(PTS), get: (m) => m.checked },
];
function strength(ci, better, cnt, n = 5) {
  if (n < 3) return "Too few runs yet";
  if (ci.lo === 0 && ci.hi === 0) return "No difference";
  const good = better > 0 ? ci.lo > 0 : ci.hi < 0, bad = better > 0 ? ci.hi < 0 : ci.lo > 0;
  if (bad) return "**Against** (GoalProof worse)";
  if (good) return !cnt ? "**Supported**" : cnt.better >= Math.ceil(0.8 * cnt.n) ? "**Strong**" : "**Moderate**";
  return better * ci.point > 0 ? "Weak (direction only)" : "None";
}
function writeReport(state, status) {
  const runs = Object.values(state.runs), total = TASKS.length * Object.keys(ARMS).length * REPS;
  const cells = (row, M) => { const c = { a: [], b: [] }; for (const r of runs) { const p = r.phases[row]; const v = p && M.get(p);
    if (v == null || Number.isNaN(v)) continue; (r.arm === "A_baseline" ? c.a : c.b).push(v); } return c; };
  const full = (c) => c.a.length && c.b.length;
  const rel = (A, B) => (A > 0 ? ` (${B >= A ? "+" : "−"}${Math.round((Math.abs(B - A) / A) * 100)}%)` : "");
  const ciCell = (M, ci, A, B) => `${M.dfmt(ci.point)} [${M.dfmt(ci.lo)}, ${M.dfmt(ci.hi)}]${M.rel ? rel(A, B) : ""}`;
  const L = ["# GoalProof convergence test", "",
    `**Status:** ${runs.length} of ${total} runs done${status ? ". " + status : ""}. Updated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.`, ""];
  if (runs.length) {
    L.push("## Headline: the claims, measured", "",
      "Each row tests one claim. **Change** is GoalProof minus without GoalProof, averaged over the five non-control task rows (T2 to T5b), with a 95% confidence interval (bootstrap). **Tasks** counts the task rows where GoalProof was better, tied, or worse.", "",
      "| Claim | Metric | Without GoalProof | With GoalProof | Change [95% CI] | Tasks better / tied / worse | Evidence |", "|---|---|---|---|---|---|---|");
    const headRows = (ROWSET) => { for (const M of METRICS) {
      const cs = ROWSET.map((r) => cells(r, M)).filter(full); if (!cs.length) continue;
      const A = mean(cs.map((c) => mean(c.a))), B = mean(cs.map((c) => mean(c.b))), ci = diffCI(cs);
      const s = cs.map((c) => Math.sign(M.better * (mean(c.b) - mean(c.a))));
      const cnt = { better: s.filter((x) => x > 0).length, tied: s.filter((x) => x === 0).length, worse: s.filter((x) => x < 0).length, n: s.length };
      L.push(`| ${M.claim} | ${M.label} | ${M.fmt(A)} | ${M.fmt(B)} | ${ciCell(M, ci, A, B)} | ${cnt.better} / ${cnt.tied} / ${cnt.worse} | ${strength(ci, M.better, cnt, Math.min(...cs.map((c) => Math.min(c.a.length, c.b.length))))} |`);
    } };
    headRows(NONCTRL);
    if (runs.some((r) => r.phases.H1 || r.phases.H2)) { L.push("", "## Held-out tasks: written after the fixes, never used to tune GoalProof", "", "Same columns, over H1 and H2 only. This is the fair test of whether the fixes generalize; the table above uses the tasks that exposed the problems.", "", "| Claim | Metric | Without GoalProof | With GoalProof | Change [95% CI] | Tasks better / tied / worse | Evidence |", "|---|---|---|---|---|---|---|"); headRows(HELDOUT); }
    if (runs.some((r) => r.phases.L1)) {
      L.push("", "## Long-horizon project: four sessions, conventions stated once", "", "Session 1 states the project conventions (amounts in cents, never modify inputs, invalid input throws). Sessions 2 to 4 each start fresh and only say \"continue\". Forgetting a convention means rework: the same correction again. This is where notes kept between sessions should save the most.", "",
        "| Claim | Metric | Without GoalProof | With GoalProof | Change [95% CI] | Sessions better / tied / worse | Evidence |", "|---|---|---|---|---|---|---|");
      headRows(LONG);
      const cum = (arm, k, get) => runs.filter((r) => r.arm === arm && r.phases.L1).map((r) => LONG.slice(0, k + 1).reduce((s, ph) => s + (r.phases[ph] ? get(r.phases[ph]) : 0), 0));
      const cf = (arm, k, get, fmt) => { const xs = cum(arm, k, get); return xs.length ? fmt(mean(xs)) : "–"; };
      L.push("", "Running totals (means over runs). If GoalProof pays off over time, its cost line starts higher and ends lower.", "", "| After session | Cost, without GoalProof | Cost, GoalProof | Human turns, without GoalProof | Human turns, GoalProof |", "|---|---|---|---|---|");
      LONG.forEach((ph, k) => L.push(`| ${k + 1} | ${cf("A_baseline", k, (p) => p.cost, D)} | ${cf("B_playbook", k, (p) => p.cost, D)} | ${cf("A_baseline", k, (p) => p.clarify + p.corrections, N)} | ${cf("B_playbook", k, (p) => p.clarify + p.corrections, N)} |`));
    }
    const single = (title, intro, row, picks) => {
      const rowsOut = [];
      for (const M of METRICS.filter((x) => picks.includes(x.label))) { const c = cells(row, M); if (!full(c)) continue;
        const A = mean(c.a), B = mean(c.b), ci = diffCI([c]);
        rowsOut.push(`| ${M.label} | ${M.fmt(A)} | ${M.fmt(B)} | ${ciCell(M, ci, A, B)} | ${strength(ci, M.better, null, Math.min(c.a.length, c.b.length))} |`); }
      if (rowsOut.length) L.push("", `## ${title}`, "", intro, "", "| Metric | Without GoalProof | With GoalProof | Change [95% CI] | Evidence |", "|---|---|---|---|---|", ...rowsOut);
    };
    single("Long term: the next session (T5b)", "A fresh session is told only \"Continue the duration work from last session.\" This is where notes kept between sessions should pay off.", "T5b",
      ["Human turns needed", "First-attempt accuracy", "Agent cost until done", "Agent time until done"]);
    single("Overhead on a trivial task (T1, control)", "GoalProof is expected to cost a little more here. This row shows how much.", "T1",
      ["Agent cost until done", "Agent time until done", "Human turns needed", "First-attempt accuracy"]);
    L.push("", "## Per task (without GoalProof → GoalProof, means)", "",
      "| Task | What it tests | Runs | First-attempt accuracy | Human turns | Correction rounds | Solved | Regressions | Cost | Time |", "|---|---|---|---|---|---|---|---|---|---|");
    for (const row of Object.keys(ROWS)) {
      const n = cells(row, METRICS[0]); if (!n.a.length && !n.b.length) continue;
      const cell = (M) => { const c = cells(row, M); return `${c.a.length ? M.fmt(mean(c.a)) : "–"} → ${c.b.length ? M.fmt(mean(c.b)) : "–"}`; };
      L.push(`| ${row} | ${ROWS[row]} | ${n.a.length} / ${n.b.length} | ${[0, 1, 2, 3, 4, 5, 6].map((i) => cell(METRICS[i])).join(" | ")} |`);
    }
    const rate = (arm, rows, get) => { const xs = runs.filter((r) => r.arm === arm).flatMap((r) => Object.entries(r.phases).filter(([k]) => !rows || rows.includes(k)).map(([, p]) => get(p))).filter((v) => v != null); return xs.length ? `${P(mean(xs.map(Number)))} (n=${xs.length})` : "–"; };
    L.push("", "## Behaviour: does the agent do what GoalProof says?", "", "| Behaviour | Without GoalProof | With GoalProof |", "|---|---|---|",
      ...[["States the task size first", null, (p) => p.sized], ["Suggests a model or effort level", null, (p) => p.suggested], ["Ran the code or tests before handing over", null, (p) => p.checked], ["Wrote PLAN.md in the two-session task (T5a)", ["T5a"], (p) => p.plan]].map(([lab, rows, get]) => `| ${lab} | ${rate("A_baseline", rows, get)} | ${rate("B_playbook", rows, get)} |`));
    const spent = runs.reduce((s, r) => s + Object.values(r.phases).reduce((x, p) => x + p.cost, 0), 0), sim = runs.reduce((s, r) => s + Object.values(r.phases).reduce((x, p) => x + p.simCost, 0), 0);
    L.push("", `Total agent cost so far: ${D(spent)}; simulated user: ${D(sim)} (API-equivalent, as reported by Claude Code).`);
  }
  L.push("", "## How to read the evidence column", "",
    "- **Strong:** the 95% CI excludes zero in GoalProof's favor, and GoalProof is better on at least 4 of the 5 task rows.",
    "- **Moderate:** the CI excludes zero in its favor, but fewer task rows agree.",
    "- **Supported** (single-task tables): the CI excludes zero in its favor.",
    "- **Weak (direction only):** better on average, but the CI includes zero, so it could be chance.",
    "- **None / No difference:** no measurable effect. **Against:** the CI excludes zero in the baseline's favor.",
    "", "## Metrics", "",
    "- **Human turn:** a message the user has to send after the first prompt, either an answer to the agent's questions or a correction after a wrong result. At most 5 per task.",
    "- **First-attempt accuracy:** share of hidden checks that pass the first time the agent hands over code (after any questions).",
    "- **Correction round:** the hidden checks failed, so the user sent back the first failure.",
    "- **Solved:** all hidden checks pass within 5 human turns.",
    "- **Regressions:** hidden checks that passed earlier, including before the agent started, and later failed. Each check counts once.",
    "- **Agent cost:** Claude Code's reported cost (API list-price equivalent), summed over every agent turn until solved or stopped. Unsolved runs count everything they spent. The simulated user's cost is excluded.",
    "- **Agent time:** the agent's working time summed over turns. It leaves out the time a real person needs to reply, so each human turn saved also saves the user's time.",
    "", "## Setup", "",
    `- Same model in both arms: Sonnet, medium effort, Claude Code ${cliVersion()}. The **without GoalProof** arm runs with GoalProof's instruction files, skills, and subagents switched off; everything else is identical.`,
    `- ${REPS} runs per task per arm, each in a fresh folder. Tasks T5a and T5b are one run in two separate sessions.`,
    "- The agent gets a short prompt. Hidden checks, which the agent never sees, decide correctness. When they fail, the user replies with a fixed template: \"I ran `f(x)` and got `y`, but I expected `z`.\"",
    "- When the agent asks questions instead of editing, a simulated user (Haiku, given the hidden requirements) answers only what was asked. Both arms get the same simulated user.",
    "- Harness: `experiments/conv.mjs`; raw data: `" + OUTNAME + "/state.json`; full transcripts: `" + OUTNAME + "/runs/`.",
    "", "## Caveats", "",
    "- The tasks were written by GoalProof's author to exercise its rules. An independent benchmark would be stronger evidence.",
    "- Small tasks, a simulated user, one model. With 5 runs per cell, differences of a few points are within noise; trust the CI, not the point estimate.",
    "- The baseline is not a weak agent: Claude Code's default instructions already encourage testing.");
  save(REPORT, L.join("\n") + "\n");
}
function cliVersion() { try { return spawnSync(findCli(), ["--version"], { encoding: "utf8", timeout: 30000 }).stdout.trim().split(/\s/)[0] || "(unknown version)"; } catch { return "(unknown version)"; } }

// ---------- main ----------
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { runs: {}, errors: {} }; } };
const waitMs = (msg) => { const m = msg.match(/\|(\d{10})\b/); if (m) { const ms = +m[1] * 1000 - Date.now() + 120000; if (ms > 0 && ms < 8 * 864e5) return ms; } return 15 * 60000; };
async function sleepChecked(ms) { const end = Date.now() + ms; while (Date.now() < end) { if (fs.existsSync(STOP)) return false; await new Promise((r) => setTimeout(r, Math.min(60000, end - Date.now()))); } return true; }
const mode = process.argv[2] ?? "selftest";
if (mode === "stop") { fs.writeFileSync(STOP, "stop"); console.log("Stop requested: the job stops before its next run (a run in progress finishes first)."); }
else if (mode === "report") { writeReport(loadState(), ""); console.log("wrote " + REPORT); }
else if (mode === "selftest") { // no model calls: starter code should fail, reference solutions should pass every check
  for (const task of TASKS) { const dir = path.join(OUT, "selftest", task.key); fs.rmSync(dir, { recursive: true, force: true }); writeTree(dir, task.files);
    for (const ph of task.phases) { const g0 = grade(dir, ph); writeTree(dir, ph.ref); const g1 = grade(dir, ph);
      console.log(`${ph.key.padEnd(4)} starter ${g0.pass}/${g0.total}  reference ${g1.pass}/${g1.total}${g1.pass === g1.total ? "" : "  <-- REFERENCE FAILS"}  | first feedback: ${g0.feedback}`); } }
}
else if (mode === "run") {
  if (fs.existsSync(LOCK)) { const pid = +fs.readFileSync(LOCK, "utf8"); try { process.kill(pid, 0); console.log("Already running (pid " + pid + ")."); process.exit(0); } catch {} }
  fs.writeFileSync(LOCK, String(process.pid)); process.on("exit", () => { try { fs.rmSync(LOCK); } catch {} });
  fs.rmSync(STOP, { force: true });
  const state = loadState(); state.errors ??= {};
  const saveState = () => save(STATE, JSON.stringify(state, null, 1));
  const order = []; for (let rep = 1; rep <= REPS; rep++) for (const task of TASKS) for (const arm of Object.keys(ARMS)) order.push({ task, arm, rep });
  let halted = false;
  for (const { task, arm, rep } of order) {
    const id = `${task.key}-${arm}-r${rep}`;
    if (fs.existsSync(STOP)) { log("stop requested"); writeReport(state, "Stopped by request; run `node conv.mjs run` to continue"); halted = true; process.exitCode = 3; break; }
    if (!state.runs[id] && (state.errors[id] ?? 0) < 3) {
      for (;;) {
        try { log("start " + id); writeReport(state, "Running " + id); state.runs[id] = await runOne(task, arm, rep); log("done " + id + " " + JSON.stringify(Object.fromEntries(Object.entries(state.runs[id].phases).map(([k, p]) => [k, p.trace.join(",")])))); break; }
        catch (e) {
          if (e instanceof LimitError) { const ms = waitMs(e.message); const until = new Date(Date.now() + ms).toLocaleString();
            log(`usage limit during ${id}; waiting until ${until}`); writeReport(state, `Paused by the usage limit; retrying ${id} from scratch around ${until}`);
            if (!(await sleepChecked(ms))) break; continue; }
          state.errors[id] = (state.errors[id] ?? 0) + 1; saveState(); log(`error ${id} (#${state.errors[id]}): ${e.message}`);
          if (state.errors[id] >= 3 || !(await sleepChecked(60000))) break;
        }
      }
      saveState(); writeReport(state, "");
    }
    if (rep === 1 && task === TASKS.at(-1) && arm === "B_playbook") { // harness check after the first full round
      const missing = order.filter((o) => o.rep === 1).map((o) => `${o.task.key}-${o.arm}-r1`).filter((k) => !state.runs[k]);
      if (missing.length) { log("HALTED: rep 1 incomplete: " + missing.join(", ")); writeReport(state, "HALTED after the harness check: runs failed (" + missing.join(", ") + "); see conv/progress.log"); halted = true; break; }
    }
  }
  if (!halted) { log("complete"); writeReport(state, "Complete"); }
}
