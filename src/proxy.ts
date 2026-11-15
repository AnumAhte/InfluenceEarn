import type { NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";
import { buildCsp, createNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // A fresh nonce per request; Next.js reads it from the request's CSP header while rendering.
  const nonce = createNonce();
  const { supabaseUrl, siteUrl } = getPublicEnv();
  const csp = buildCsp(nonce, { supabaseUrl, siteUrl, isDev: process.env.NODE_ENV === "development" });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, image optimisation and link prefetches (no CSP needed).
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.png|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
