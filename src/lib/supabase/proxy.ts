import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";
import { resolveRouteAccess } from "@/lib/auth/route-access";
import type { Database } from "./database.types";

/**
 * Refreshes the Supabase session cookie and applies coarse route guards.
 * Fine-grained checks (onboarding state, admin role) happen server-side in layouts,
 * because they need database reads.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it validates the
  // JWT and refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const access = resolveRouteAccess(pathname, isSignedIn);

  if (access.type === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = access.to;
    url.search = "";
    if (access.withNext) url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    // Carry refreshed auth cookies across the redirect.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}
