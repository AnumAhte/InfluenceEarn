import { describe, expect, it } from "vitest";

import { buildCsp, createNonce } from "./csp";

const opts = { supabaseUrl: "https://abc.supabase.co/", siteUrl: "https://influencearn.com", isDev: false };

describe("buildCsp", () => {
  it("allows only nonce'd scripts in production", () => {
    const csp = buildCsp("n0nce", opts);
    expect(csp).toContain("script-src 'self' 'nonce-n0nce' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain("unsafe-eval");
  });

  it("blocks framing, plugins and foreign form targets", () => {
    const csp = buildCsp("n", opts);
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "form-action 'self'", "base-uri 'self'"]) expect(csp).toContain(d);
  });

  it("allows the Supabase origin for images and requests", () => {
    const csp = buildCsp("n", opts);
    expect(csp).toContain("img-src 'self' data: blob: https://abc.supabase.co");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co");
  });

  it("upgrades insecure requests only on HTTPS sites; dev adds eval and websockets", () => {
    expect(buildCsp("n", opts)).toContain("upgrade-insecure-requests");
    const dev = buildCsp("n", { ...opts, siteUrl: "http://localhost:3000", isDev: true });
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws:");
  });

  it("creates a different nonce every time", () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});
