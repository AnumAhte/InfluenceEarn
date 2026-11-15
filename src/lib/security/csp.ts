/**
 * Content-Security-Policy with a per-request script nonce (set in the proxy; Next.js applies the
 * nonce to its own scripts during dynamic rendering).
 *
 * - Scripts: only nonce'd scripts and what they load ('strict-dynamic'); no inline or injected
 *   scripts. 'unsafe-eval' only in development (React dev tooling).
 * - Styles: 'unsafe-inline' is required for style attributes (Radix, React style props), which
 *   nonces can't cover. Script injection, the main XSS risk, stays blocked.
 * - Images and fetches: this site and the Supabase project (signed storage URLs, auth).
 */
export function buildCsp(nonce: string, { supabaseUrl, siteUrl, isDev }: { supabaseUrl: string; siteUrl: string; isDev: boolean }) {
  const supabase = new URL(supabaseUrl).origin;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}${isDev ? " ws: wss:" : ""}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only on HTTPS deployments (it would break a production build served over http://localhost).
    ...(siteUrl.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

export function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
