/**
 * Returns `target` only if it is a same-origin relative path; otherwise `fallback`.
 * Prevents open redirects through `?next=` parameters.
 */
export function safeRedirectPath(target: string | null | undefined, fallback = "/dashboard"): string {
  if (!target) return fallback;
  if (!target.startsWith("/")) return fallback;
  // Protocol-relative ("//evil.com") and backslash tricks ("/\evil.com").
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;
  if ([...target].some((ch) => ch.charCodeAt(0) < 0x20)) return fallback;
  return target;
}
