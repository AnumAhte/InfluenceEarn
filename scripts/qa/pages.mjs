// Browser QA (production build, real CSP): every page per role at desktop and phone widths; console,
// hydration and CSP errors, horizontal overflow, menus/drawers. Screenshots → .qa/shots.
// Run: npm run build && npm start -- -p 3100; MODE=prod node scripts/qa/seed.mjs; node scripts/qa/pages.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const DIR = resolve(".qa");
const SHOTS = join(DIR, "shots");
mkdirSync(SHOTS, { recursive: true });
const APP = "http://localhost:3100";
const PASSWORD = "correct-horse-9";
const U = JSON.parse(readFileSync(join(DIR, "users.json"), "utf8"));
const only = process.argv[2]; // optional role filter

const VIEWPORTS = { desktop: { width: 1366, height: 900 }, mobile: { width: 390, height: 844 } };
const ROLES = {
  public: { email: null, pages: ["/", "/terms", "/privacy", "/login", "/signup", "/forgot-password", "/does-not-exist"] },
  advertiser: {
    email: U.adv,
    pages: ["/dashboard", "/campaigns", "/campaigns/new", `/campaigns/${U.live}`, `/campaigns/${U.live}/applicants`, `/campaigns/${U.live}/submissions`,
      `/campaigns/${U.open}`, `/campaigns/${U.open}/applicants`, "/reviews", "/wallet", "/notifications", "/settings/profile", "/settings/notifications", "/settings/account"],
  },
  influencer: {
    email: U.cre,
    pages: ["/dashboard", "/discover", `/discover/${U.open}`, "/applications", "/tasks", "/tasks?view=completed", "/wallet", "/notifications",
      "/settings/social", "/settings/creator", "/settings/profile", "/settings/notifications", "/settings/account"],
  },
  admin: {
    email: U.admin,
    pages: ["/admin", "/admin/users", "/admin/campaigns", "/admin/reviews", "/admin/payouts", "/admin/transactions", "/admin/activity", "/admin/settings"],
  },
};

const results = [];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });

for (const [role, cfg] of Object.entries(ROLES)) {
  if (only && only !== role) continue;
  for (const [vp, size] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, isMobile: vp === "mobile", hasTouch: vp === "mobile" });
    const page = await context.newPage();
    let issues = [];
    page.on("console", (m) => { if (m.type() === "error") issues.push(`console: ${m.text().slice(0, 220)}`); });
    page.on("pageerror", (e) => issues.push(`pageerror: ${e.message.slice(0, 220)}`));

    if (cfg.email) {
      await page.goto(`${APP}/login`);
      await page.fill('input[name="email"]', cfg.email);
      await page.fill('input[name="password"]', PASSWORD);
      await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')]);
      results.push({ role, vp, path: "(sign in)", ok: !page.url().includes("/login"), notes: [page.url()] });
    }

    for (const path of cfg.pages) {
      issues = [];
      const res = await page.goto(`${APP}${path}`, { waitUntil: "networkidle" }).catch((e) => ({ status: () => `ERR ${e.message}` }));
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => {
        const w = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth <= w + 1) return null;
        const offenders = [...document.querySelectorAll("body *")]
          .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > w + 1 && getComputedStyle(el).position !== "fixed"; })
          .filter((el, _, all) => !all.some((o) => o !== el && el.contains(o)))
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 3).join(".") : ""} "${(el.textContent ?? "").trim().slice(0, 40)}"`);
        return { scrollWidth: document.documentElement.scrollWidth, width: w, offenders };
      });
      const name = `${role}-${vp}-${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`.slice(0, 120);
      await page.screenshot({ path: join(SHOTS, name), fullPage: true });
      const status = typeof res?.status === "function" ? res.status() : "?";
      // The not-found page legitimately logs its own 404 response.
      const notes = issues.filter((n) => !(path === "/does-not-exist" && n.includes("status of 404")));
      if (overflow) notes.push(`overflow: ${overflow.scrollWidth}px > ${overflow.width}px :: ${overflow.offenders.join(" | ")}`);
      results.push({ role, vp, path, status, ok: (status === 200 || (path === "/does-not-exist" && status === 404)) && notes.length === 0, notes, shot: name });
    }

    // Client JavaScript works under the CSP: open the shell's menu/drawer.
    if (cfg.email) {
      await page.goto(`${APP}${cfg.pages[0]}`, { waitUntil: "networkidle" });
      const trigger = vp === "mobile" ? page.getByRole("button", { name: /menu|navigation/i }).first() : page.locator('button[aria-haspopup="menu"]').last();
      let opened = false;
      try {
        await trigger.click({ timeout: 5000 });
        opened = await page.locator('[role="dialog"], [role="menu"]').first().isVisible({ timeout: 5000 });
        await page.screenshot({ path: join(SHOTS, `${role}-${vp}-menu-open.png`) });
      } catch (e) { issues.push(`menu: ${e.message.slice(0, 120)}`); }
      results.push({ role, vp, path: vp === "mobile" ? "(open nav drawer)" : "(open user menu)", ok: opened, notes: issues });
    }
    await context.close();
  }
}
await browser.close();

writeFileSync(join(DIR, "results.json"), JSON.stringify(results, null, 2));
const bad = results.filter((r) => !r.ok);
console.log(`${results.length - bad.length}/${results.length} checks clean`);
for (const r of bad) console.log(`✗ [${r.role} ${r.vp}] ${r.path} status=${r.status ?? ""}\n    ${r.notes.join("\n    ")}`);
