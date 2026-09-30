"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BASE_CURRENCY, cents } from "@/domain/money";
import { getCurrentAccount } from "@/features/account/queries";
import { getPayoutProvider } from "@/features/payments/providers";
import { createClient } from "@/lib/supabase/server";

export type PayoutActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function describePayoutError(message: string | undefined): string {
  const m = message ?? "";
  if (m.startsWith("admin_required")) return "Only agency admins can do this.";
  if (m.startsWith("reason_required")) return "Add a reason for the hold.";
  if (m.startsWith("payout_already_paid")) return "This payout has already been paid.";
  if (m.startsWith("payout_not_allowed")) return "This item can't be paid out in its current state.";
  if (m.startsWith("insufficient_reserve")) return "The campaign's reserve doesn't cover this payout. Check the campaign's funding.";
  if (m.startsWith("stale_payout_attempt")) return "This payout changed in the meantime. Refresh and try again.";
  if (m.startsWith("test_mode_disabled")) return "Test payouts are disabled in this environment.";
  if (m.startsWith("assignment_not_found") || m.startsWith("payout_not_found")) return "Not found.";
  return "Something went wrong. Please try again.";
}

/** Server-side admin check (the database checks again in every function). */
async function requireAdminSession() {
  const account = await getCurrentAccount();
  if (!account?.isAdmin) return null;
  return createClient();
}

/**
 * Release payment: start (or retry) the payout, ask the provider to pay, record the
 * outcome. The same idempotency key is used for an attempt, so a retried request never
 * pays twice; the database books the ledger only once per payout.
 */
export async function releasePayout(_previous: PayoutActionState, formData: FormData): Promise<PayoutActionState> {
  const input = z.object({ assignmentId: z.uuid() }).safeParse({ assignmentId: formData.get("assignmentId") });
  if (!input.success) return { status: "error", message: "Invalid request." };

  const supabase = await requireAdminSession();
  if (!supabase) return { status: "error", message: "Only agency admins can do this." };

  const provider = getPayoutProvider();
  if (!provider) {
    return { status: "error", message: "No payout provider is connected, so payments can't be released yet." };
  }

  const { data: started, error: startError } = await supabase.rpc("start_payout", {
    p_assignment_id: input.data.assignmentId,
    p_provider: provider.id,
  });
  const payout = started?.[0];
  if (startError || !payout) return { status: "error", message: describePayoutError(startError?.message) };
  if (payout.already_processing) {
    return { status: "error", message: "This payout is already being processed." };
  }

  const { data: payoutRow } = await supabase.from("payouts").select("creator_id").eq("id", payout.payout_id).single();

  let result: Awaited<ReturnType<typeof provider.createPayout>>;
  try {
    result = await provider.createPayout({
      payoutId: payout.payout_id,
      recipientUserId: payoutRow?.creator_id ?? "",
      amountCents: cents(payout.amount_cents),
      currency: BASE_CURRENCY,
      idempotencyKey: `payout:${payout.payout_id}:${payout.attempt}`,
    });
  } catch {
    result = { providerReference: `error_${payout.payout_id.slice(0, 8)}`, status: "failed", failureReason: "The payout provider could not be reached." };
  }

  revalidatePath("/admin", "layout");
  if (result.status === "processing") {
    return { status: "success", message: "Sent to the payout provider. It will update when the provider confirms." };
  }

  const { error: recordError } = await supabase.rpc("record_payout_result", {
    p_payout_id: payout.payout_id,
    p_attempt: payout.attempt,
    p_status: result.status === "succeeded" ? "paid" : "failed",
    p_provider_reference: result.providerReference,
    p_failure_reason: result.failureReason,
  });
  revalidatePath("/admin", "layout");
  if (recordError) return { status: "error", message: describePayoutError(recordError.message) };

  return result.status === "succeeded"
    ? { status: "success", message: "Payment released." }
    : { status: "error", message: `Payout failed: ${result.failureReason ?? "the provider declined it."} You can retry or put it on hold.` };
}

export async function holdPayout(_previous: PayoutActionState, formData: FormData): Promise<PayoutActionState> {
  const input = z
    .object({ assignmentId: z.uuid(), reason: z.string().trim().min(3, { error: "Add a reason for the hold." }).max(500) })
    .safeParse({ assignmentId: formData.get("assignmentId"), reason: formData.get("reason") ?? "" });
  if (!input.success) return { status: "error", message: input.error.issues[0]?.message ?? "Invalid request." };

  const supabase = await requireAdminSession();
  if (!supabase) return { status: "error", message: "Only agency admins can do this." };

  const { error } = await supabase.rpc("hold_payout", { p_assignment_id: input.data.assignmentId, p_reason: input.data.reason });
  revalidatePath("/admin", "layout");
  if (error) return { status: "error", message: describePayoutError(error.message) };
  return { status: "success", message: "Payout put on hold." };
}
