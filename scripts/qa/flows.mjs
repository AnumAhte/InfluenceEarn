// Interactive browser flows (production build, real CSP): wizard draft, applying, suspend/reinstate.
// Run after scripts/qa/seed.mjs: node scripts/qa/flows.mjs
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const DIR = resolve(".qa");
const APP = "http://localhost:3100";
const U = JSON.parse(readFileSync(join(DIR, "users.json"), "utf8"));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let passed = 0, failed = 0;
const check = (name, ok, detail = "") => { if (ok) passed++; else failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + detail}`); };

async function signedIn(email, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${APP}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "correct-horse-9");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click('button[type="submit"]')]);
  return { context, page, errors };
}

// ── Advertiser: create a draft through the wizard (phone width) ──
{
  const { context, page, errors } = await signedIn(U.adv, { width: 390, height: 844 });
  await page.goto(`${APP}/campaigns/new`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Continue" }).click();
  check("wizard validates step 1 in the browser", await page.getByText(/at least|Enter|Choose/i).first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  await page.getByLabel("Campaign name").fill("Browser QA Campaign");
  await page.getByLabel("Description").fill("Promote our autumn range with one Instagram Reel showing three outfits from the new collection.");
  await page.getByRole("radiogroup", { name: "Category" }).getByRole("radio", { name: "Fashion" }).click();
  await page.getByText("Product launch").click();
  await page.getByRole("button", { name: "Save draft" }).click();
  const saved = await page.getByText(/Draft saved at/).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  const say = async () => (await page.locator("main").innerText()).split("\n").filter((l) => /fix|draft|error|must|enter|choose|least/i.test(l)).slice(0, 6).join(" / ");
  check("saving a draft from the wizard succeeds", saved, await say());
  await page.getByRole("button", { name: "Continue" }).click();
  check("continuing moves to step 2", await page.getByText(/Step 2 of 4/).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false), await say());
  check("no client errors during the wizard", errors.length === 0, errors.join(" | ").slice(0, 300));
  await context.close();
}

// ── Influencer: apply to an open campaign (desktop) ──
{
  const { context, page, errors } = await signedIn(U.cre, { width: 1366, height: 900 });
  await page.goto(`${APP}/discover/${U.open}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Submit application" }).click();
  await page.waitForURL(/applied=1/, { timeout: 15000 }).catch(() => {});
  check("creator applies from the campaign page", page.url().includes("applied=1") || (await page.getByText(/You applied|Application sent|Applied/i).first().isVisible().catch(() => false)), page.url());
  await page.goto(`${APP}/applications`, { waitUntil: "networkidle" });
  check("the application appears under My applications", await page.getByText("Spring Menu Teaser").first().isVisible());
  check("no client errors while applying", errors.length === 0, errors.join(" | ").slice(0, 300));
  await context.close();
}

// ── Admin: suspend and reinstate through the UI (phone width) ──
{
  const { context, page, errors } = await signedIn(U.admin, { width: 390, height: 844 });
  await page.goto(`${APP}/admin/users?q=${encodeURIComponent(U.cre2)}`, { waitUntil: "networkidle" });
  await page.getByText("Daniel Osei").first().click();
  await page.waitForURL(/\/admin\/users\/[0-9a-f-]{36}/);
  await page.getByLabel(/Reason/).fill("Browser QA: testing suspension");
  await page.getByRole("button", { name: "Suspend account" }).click();
  check("admin suspends from the user page", await page.getByText(/Account suspended\./).waitFor({ timeout: 15000 }).then(() => true).catch(() => false));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Reinstate account" }).click();
  check("admin reinstates from the user page", await page.getByText(/Account reinstated\./).waitFor({ timeout: 15000 }).then(() => true).catch(() => false));
  check("no client errors in admin flows", errors.length === 0, errors.join(" | ").slice(0, 300));
  await context.close();
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
