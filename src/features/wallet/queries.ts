import "server-only";

import { cents, type Cents } from "@/domain/money";
import { createClient } from "@/lib/supabase/server";

export const WALLET_PAGE_SIZE = 15;

export type StatementFilter = "all" | "deposits" | "campaign_funding";

/** Available balance, derived from ledger entries (0 if no wallet exists yet). */
export async function getMyWalletBalance(userId: string): Promise<{ walletId: string | null; availableCents: Cents }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wallet_account_balances")
    .select("account_id, balance_cents")
    .eq("kind", "user_wallet")
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw new Error("Wallet balance could not be loaded.", { cause: error });
  return { walletId: data?.account_id ?? null, availableCents: cents(data?.balance_cents ?? 0) };
}

/** One page of the user's wallet statement (ledger entries with running balance). */
export async function listMyStatement(userId: string, filter: StatementFilter, page: number) {
  const supabase = await createClient();
  let query = supabase
    .from("wallet_statement")
    .select("id, entry_type, amount_cents, balance_after_cents, created_at, transaction_kind, description, campaign_id, is_test", {
      count: "exact",
    })
    .eq("owner_id", userId);

  if (filter === "deposits") query = query.eq("entry_type", "mock_deposit");
  if (filter === "campaign_funding") query = query.eq("entry_type", "campaign_funding_debit");

  const offset = (page - 1) * WALLET_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + WALLET_PAGE_SIZE - 1);

  if (error) throw new Error("Transactions could not be loaded.", { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}

/** Campaigns this user has funded, newest first. */
export async function listMyCampaignFunding(userId: string, limit = 5) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_funding")
    .select("id, total_cents, creator_budget_cents, platform_fee_cents, created_at, campaign:campaigns(id, title, status)")
    .eq("payer_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Campaign funding could not be loaded.", { cause: error });
  return data ?? [];
}

/** Whether the database allows development test funds (never true in production). */
export async function areTestFundsEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("test_funds_enabled").maybeSingle();
  return data?.test_funds_enabled === true;
}
