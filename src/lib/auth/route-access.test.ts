import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "../utils/safe-redirect";
import { resolveRouteAccess } from "./route-access";

describe("resolveRouteAccess", () => {
  it("sends signed-out visitors on protected pages to login with a return path", () => {
    for (const path of ["/dashboard", "/onboarding/role", "/settings/profile", "/admin", "/admin/payouts", "/campaigns", "/campaigns/new", "/wallet"]) {
      expect(resolveRouteAccess(path, false)).toEqual({ type: "redirect", to: "/login", withNext: true });
    }
  });

  it("does not treat look-alike paths as protected", () => {
    expect(resolveRouteAccess("/administrator", false)).toEqual({ type: "allow" });
    expect(resolveRouteAccess("/dashboards", false)).toEqual({ type: "allow" });
  });

  it("keeps public pages public", () => {
    for (const path of ["/", "/login", "/signup", "/forgot-password", "/auth/confirm"]) {
      expect(resolveRouteAccess(path, false)).toEqual({ type: "allow" });
    }
  });

  it("requires a recovery session for the reset-password page", () => {
    expect(resolveRouteAccess("/reset-password", false)).toEqual({
      type: "redirect",
      to: "/forgot-password",
      withNext: false,
    });
    expect(resolveRouteAccess("/reset-password", true)).toEqual({ type: "allow" });
  });

  it("moves signed-in users away from guest-only pages", () => {
    expect(resolveRouteAccess("/login", true)).toEqual({ type: "redirect", to: "/dashboard", withNext: false });
    expect(resolveRouteAccess("/signup", true)).toEqual({ type: "redirect", to: "/dashboard", withNext: false });
    expect(resolveRouteAccess("/dashboard", true)).toEqual({ type: "allow" });
  });
});

describe("safeRedirectPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeRedirectPath("/settings/profile?tab=1")).toBe("/settings/profile?tab=1");
  });

  it("blocks open redirects", () => {
    for (const target of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "evil", "/\nfoo"]) {
      expect(safeRedirectPath(target, "/dashboard")).toBe("/dashboard");
    }
    expect(safeRedirectPath(null)).toBe("/dashboard");
  });
});
