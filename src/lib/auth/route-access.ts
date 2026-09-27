/** Paths that require a signed-in user. */
export const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/settings", "/admin", "/campaigns", "/wallet", "/discover", "/applications", "/notifications"] as const;

/** Pages that only make sense for signed-out visitors. */
export const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"] as const;

/** Reached through a password-recovery link, which creates a session first. */
export const RECOVERY_PATH = "/reset-password";

export type RouteAccess =
  | { type: "allow" }
  | { type: "redirect"; to: string; withNext: boolean };

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function resolveRouteAccess(pathname: string, isSignedIn: boolean): RouteAccess {
  if (!isSignedIn && isProtectedPath(pathname)) {
    return { type: "redirect", to: "/login", withNext: true };
  }
  if (!isSignedIn && matchesPrefix(pathname, RECOVERY_PATH)) {
    return { type: "redirect", to: "/forgot-password", withNext: false };
  }
  if (isSignedIn && GUEST_ONLY_PATHS.some((path) => matchesPrefix(pathname, path))) {
    return { type: "redirect", to: "/dashboard", withNext: false };
  }
  return { type: "allow" };
}
