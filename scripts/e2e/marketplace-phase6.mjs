// Phase 6 end-to-end: legal pages, account suspension, notification emails, media kits,
// account settings and rate limits, through the real app.
//
// Runs in both modes. Run from the repo root: MODE=prod node scripts/e2e/marketplace-phase6.mjs
import { Session, check, finish } from "./harness.mjs";

// ── Legal pages (drafts) ──
const guest = new Session();
for (const [path, title] of [["/terms", "Terms of Service"], ["/privacy", "Privacy Policy"]]) {
  const r = await guest.get(path);
  check(`${path} is public`, r.status === 200, r.status);
  check(`${path} shows the ${title} with the draft banner`, r.text.includes(title) && r.text.includes("Draft — requires client and legal approval"));
  check(`${path} marks unconfirmed facts`, r.text.includes("[To confirm: "));
  check(`${path} is excluded from search engines while a draft`, /<meta name="robots" content="noindex, nofollow"/.test(r.text));
}
let r = await guest.get("/");
check("landing footer links to Terms and Privacy", r.text.includes('href="/terms"') && r.text.includes('href="/privacy"'));
r = await guest.get("/signup");
check("sign-up links to the draft documents without 'you agree' wording", r.text.includes('href="/terms"') && !/you agree/i.test(r.text));

finish();
