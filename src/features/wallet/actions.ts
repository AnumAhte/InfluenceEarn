"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { BASE_CURRENCY, formatMoney, parseDollarsToCents } from "@/domain/money";
import { describeDbError } from "@/features/campaigns/errors";
import { getWalletFundingProvider } from "@/features/payments/providers";
import { createClient } from "@/lib/supabase/server";

export type AddTestFundsState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "succeeded"; message: string }
  | { status: "failed"; message: string };

const MAX_TEST_DEPOSIT_CENTS = 10_000_000; // $100,000

const inputSchema = z.object({
  amount: z.string().trim().min(1, { error: "Enter an amount" }).max(20),
  idempotencyKey: z.uuid(),
});

/**
 * DEVELOPMENT ONLY. Adds test funds through the mock provider. Blocked in three
 * places: the provider registry never returns the mock in production, the mock
 * refuses to run in production, and the database function requires
 * `platform_settings.test_funds_enabled` (false unless seeded locally).
 */
export async function addTestFunds(_previous: AddTestFundsState, formData: FormData): Promise<AddTestFundsState> {
  const provider = getWalletFundingProvider();
  if (!provider || !provider.isTestMode) {
    return { status: "error", message: "Adding funds isn't available yet. A payment provider has not been connected." };
  }

  const input = inputSchema.safeParse({ amount: formData.get("amount"), idempotencyKey: formData.get("idempotencyKey") });
  if (!input.success) return { status: "error", message: input.error.issues[0]?.message ?? "Invalid request." };

  const amountCents = parseDollarsToCents(input.data.amount);
  if (amountCents === null || amountCents <= 0) {
    return { status: "error", message: "Enter an amount like 500 or 500.00." };
  }
  if (amountCents > MAX_TEST_DEPOSIT_CENTS) {
    return { status: "error", message: "Test deposits are limited to $100,000 at a time." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const result = await provider.createDeposit({
    userId,
    amountCents,
    currency: BASE_CURRENCY,
    idempotencyKey: input.data.idempotencyKey,
  });

  const { data, error } = await supabase.rpc("record_test_deposit", {
    p_amount_cents: amountCents,
    p_currency: BASE_CURRENCY,
    p_provider_reference: result.providerReference,
    p_status: result.status,
    p_idempotency_key: input.data.idempotencyKey,
    p_failure_reason: result.failureReason,
  });

  if (error) return { status: "error", message: describeDbError(error).message };

  revalidatePath("/wallet");
  revalidatePath("/campaigns", "layout");

  const outcome = data?.[0];
  if (outcome?.replayed) {
    return { status: "succeeded", message: "This test deposit was already recorded — it was not added twice." };
  }
  if (outcome?.status === "failed") {
    return { status: "failed", message: result.failureReason ?? "The mock provider declined this test deposit." };
  }
  return { status: "succeeded", message: `${formatMoney(amountCents)} in test funds added.` };
}
