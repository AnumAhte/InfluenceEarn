// Runs end-to-end suites one after another and prints a summary.
//
//   npm run e2e:prod   → suites that run against `next build && next start -p 3100`
//   npm run e2e:dev    → suites that need `next dev -p 3100` (development-only mock payout provider)
//
// A suite passes only if it exits 0 and printed its "N passed, M failed" line. A suite that exits
// without that line (a crash) is reported as CRASHED with its full output, never as passed.
import { spawnSync } from "node:child_process";

const SUITES = {
  prod: ["wallet-campaigns.mjs", "social-applications.mjs", "submissions-reviews.mjs", "payouts-refunds.mjs"],
  dev: ["payouts-refunds.mjs", "payout-retry.mjs"],
};

const mode = process.argv[2];
if (!SUITES[mode]) {
  console.log("Usage: node scripts/e2e/run.mjs <prod|dev>");
  process.exit(1);
}

const results = [];
for (const suite of SUITES[mode]) {
  console.log(`\n▶ ${suite} (MODE=${mode})`);
  const run = spawnSync(process.execPath, [`scripts/e2e/${suite}`], { env: { ...process.env, MODE: mode }, encoding: "utf8" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  // Only the final line written by finish() counts; a CRASH line also mentions passed/failed counts.
  const summary = output.match(/^(\d+) passed, (\d+) failed {2}\(/m);
  const status = run.status === 2 || !summary ? "CRASHED" : run.status === 0 ? "PASSED" : "FAILED";
  // Print failing checks always; print everything when a suite did not finish cleanly.
  if (status === "PASSED") console.log(output.split("\n").filter((l) => l.startsWith("FAIL")).join("\n") || "  all checks passed");
  else console.log(output);
  results.push({ suite, status, exit: run.status, passed: summary?.[1] ?? "-", failed: summary?.[2] ?? "-" });
}

console.log(`\nSummary (MODE=${mode})`);
for (const r of results) console.log(`  ${r.status.padEnd(8)} ${r.suite.padEnd(26)} ${r.passed} passed, ${r.failed} failed  (exit ${r.exit})`);
process.exit(results.every((r) => r.status === "PASSED") ? 0 : 1);
