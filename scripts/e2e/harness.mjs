// Shared harness for the end-to-end suites in this folder.
//
// The suites drive the real app over HTTP the way the browser does: pages with GET, server
// actions with the `Next-Action` header (ids read from the build's server-reference manifest).
// They need a local Supabase (`npx supabase start`, seed.sql applied) with Mailpit on :54324,
// and the app on http://localhost:3100. Run them from the repository root.
//
//   MODE=prod (default): `next build && next start -p 3100`
//   MODE=dev:            `next dev -p 3100` (needed for the development-only mock payout provider)
//
// Diagnostics: if a suite crashes instead of finishing, the harness prints CRASH with the error,
// the last passed/failed check and the last HTTP request, and exits with code 2. A run that
// finishes prints "N passed, M failed" and exits 0 or 1. Anything else is not a valid result.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const require = createRequire(resolve(ROOT, "package.json"));
export const { createClient } = require("@supabase/supabase-js");

export const MODE = process.env.MODE ?? "prod";
export const APP = process.env.APP_URL ?? "http://localhost:3100";
export const MAILPIT = "http://127.0.0.1:54324";
export const SUPABASE_URL = "http://127.0.0.1:54321";
// The local Supabase CLI's default publishable key: public by design and only valid locally.
export const PUBLISHABLE_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
export const PASSWORD = "correct-horse-9";
const REQUEST_TIMEOUT_MS = 120_000;
const MAIL_TIMEOUT_MS = 30_000;

// ── Results and crash diagnostics ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let lastCheck = "(none yet)";
let lastRequest = "(none yet)";
const startedAt = Date.now();

export function check(name, ok, detail = "") {
  lastCheck = `${ok ? "PASS" : "FAIL"} ${name}`;
  if (ok) { passed++; console.log(`PASS  ${name}`); }
  else { failed++; console.log(`FAIL  ${name}  ${String(detail).slice(0, 300)}`); }
}

export function finish() {
  console.log(`\n${passed} passed, ${failed} failed  (${((Date.now() - startedAt) / 1000).toFixed(1)}s, MODE=${MODE})`);
  process.exit(failed ? 1 : 0);
}

function crash(kind, error) {
  console.log(`\nCRASH (${kind}) after ${passed} passed, ${failed} failed  (${((Date.now() - startedAt) / 1000).toFixed(1)}s, MODE=${MODE})`);
  console.log(`  last check:   ${lastCheck}`);
  console.log(`  last request: ${lastRequest}`);
  console.log(`  error:        ${error?.stack ?? error}`);
  // fetch() hides the network reason (ECONNREFUSED, ECONNRESET, timeout) in `cause`.
  if (error?.cause) console.log(`  cause:        ${error.cause.code ?? ""} ${error.cause.message ?? error.cause}`);
  process.exit(2);
}
process.on("uncaughtException", (e) => crash("uncaughtException", e));
process.on("unhandledRejection", (e) => crash("unhandledRejection", e));

// ── Server-action ids ─────────────────────────────────────────────────────────────────────
const MANIFEST = resolve(ROOT, MODE === "dev" ? ".next/dev/server/server-reference-manifest.json" : ".next/server/server-reference-manifest.json");
let ACTION = {};
function loadActions() {
  try {
    const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
    ACTION = Object.fromEntries(Object.entries(m.node).map(([id, v]) => [v.exportedName, id]));
  } catch {
    // In dev the manifest appears once pages compile; Session.action reloads it on demand.
  }
}
loadActions();

async function http(method, path, init, label = `${method} ${path}`) {
  const t0 = Date.now();
  lastRequest = `${label} (in flight)`;
  const res = await fetch(APP + path, { ...init, method, redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await res.text();
  lastRequest = `${label} -> ${res.status} in ${Date.now() - t0}ms`;
  return { res, text };
}

export class Session {
  jar = new Map();
  store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i), value = pair.slice(i + 1);
      if (value === "" || /max-age=0/i.test(c)) this.jar.delete(name); else this.jar.set(name, value);
    }
  }
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  async get(path) {
    const { res, text } = await http("GET", path, { headers: { cookie: this.cookie() } });
    this.store(res);
    return { status: res.status, location: res.headers.get("location"), text };
  }
  /** args: array; FormData args are encoded with React's `$K` reference format. */
  async action(page, name, args) {
    if (!ACTION[name]) { await this.get(page); loadActions(); } // dev: compile the page first
    const id = ACTION[name];
    if (!id) throw new Error(`No server action "${name}" in ${MANIFEST} (is the app built/compiled for MODE=${MODE}?)`);
    let body;
    const headers = { "Next-Action": id, cookie: this.cookie(), Accept: "text/x-component" };
    const formIndex = args.findIndex((a) => a instanceof FormData);
    if (formIndex === -1) {
      body = JSON.stringify(args);
      headers["Content-Type"] = "text/plain;charset=UTF-8";
    } else {
      body = new FormData();
      for (const [k, v] of args[formIndex].entries()) body.append(`_1_${k}`, v);
      body.append("0", JSON.stringify(args.map((a, i) => (i === formIndex ? "$K1" : a)))); // root last, like encodeReply
    }
    const { res, text } = await http("POST", page, { headers, body }, `POST ${page} [${name}]`);
    this.store(res);
    return { status: res.status, redirect: res.headers.get("x-action-redirect"), text };
  }
}

export const form = (obj) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) { if (Array.isArray(v)) v.forEach((x) => f.append(k, x)); else f.append(k, v); }
  return f;
};

/** Waits for the signup confirmation email in Mailpit and returns its /auth/confirm link. */
export async function waitForConfirmLink(email) {
  const deadline = Date.now() + MAIL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const search = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:" + email)}`)).json();
    const id = search.messages?.[0]?.ID;
    if (id) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const link = (msg.HTML.match(/href="([^"]*auth\/confirm[^"]*)"/) ?? [])[1];
      if (link) return link.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No confirmation email for ${email} within ${MAIL_TIMEOUT_MS / 1000}s (is Mailpit running on :54324?)`);
}

/** Signs up, confirms by email, onboards into `workspace` and skips the profile step. */
export async function newUser(label, workspace, fullName) {
  const s = new Session();
  s.email = `e2e-${label}-${Date.now()}@test.local`;
  await s.action("/signup", "signUp", [{ status: "idle" }, form({ fullName, email: s.email, password: PASSWORD, confirmPassword: PASSWORD })]);
  const url = new URL(await waitForConfirmLink(s.email));
  await s.get(url.pathname + url.search);
  await s.action("/onboarding/role", "chooseInitialWorkspace", [form({ workspace })]);
  await s.action("/onboarding/profile", "skipProfileSetup", []);
  const r = await s.get("/dashboard");
  check(`[${label}] signed up, confirmed and onboarded as ${workspace}`, r.status === 200, r.status);
  return s;
}

/** Runs SQL as the local superuser (test setup and ledger assertions only). */
export const psql = (sql) =>
  execFileSync("docker", ["exec", "supabase_db_influencearn", "psql", "-U", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();

export const sameCampaign = (redirect, id) => Boolean(redirect) && (redirect === `/campaigns/${id}` || redirect.startsWith(`/campaigns/${id};`));
export const isNotFound = (r) => r.status === 404 || r.text.includes("NEXT_HTTP_ERROR_FALLBACK;404");

/** Fails fast with a clear message when a suite needs the other MODE. */
export function requireMode(mode, why) {
  if (MODE !== mode) {
    console.log(`This suite needs MODE=${mode}: ${why}`);
    process.exit(1);
  }
}
