import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Ends the session of a suspended account (cookies can only be cleared here) and explains why. */
export async function GET() {
  const supabase = await createClient();
  // The server-side session is already deleted; this clears the browser's cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?error=account_suspended");
}
