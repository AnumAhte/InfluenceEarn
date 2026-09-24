"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { campaignDraftSchema, fundingReadinessIssues, toSaveDraftArgs } from "@/domain/campaigns/schemas";
import { createClient } from "@/lib/supabase/server";

import { describeDbError, type FundingFailure } from "./errors";

export type SaveCampaignResult =
  | { status: "saved"; campaignId: string; savedAt: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const saveInputSchema = z.object({
  campaignId: z.uuid().nullable(),
  intent: z.enum(["save", "continue"]),
});

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function flattenIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/**
 * Saves the wizard state as a draft (atomically, via `save_campaign_draft`).
 * `intent: "continue"` additionally requires a complete campaign and moves it to
 * `funding_required`, then continues to the funding page.
 */
export async function saveCampaignDraft(input: {
  campaignId: string | null;
  intent: "save" | "continue";
  draft: unknown;
}): Promise<SaveCampaignResult> {
  const meta = saveInputSchema.safeParse(input);
  if (!meta.success) return { status: "error", message: "Invalid request." };

  const parsed = campaignDraftSchema.safeParse(input.draft);
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: flattenIssues(parsed.error.issues) };
  }

  if (meta.data.intent === "continue") {
    const missing = fundingReadinessIssues(parsed.data, todayUtc());
    if (missing.length > 0) {
      return {
        status: "error",
        message: "Complete every step before continuing to funding.",
        fieldErrors: Object.fromEntries(missing.map((issue) => [issue.path, issue.message])),
      };
    }
  }

  const { supabase } = await requireUserId();
  const args = toSaveDraftArgs(parsed.data);
  const { data: campaignId, error } = await supabase.rpc("save_campaign_draft", {
    p_campaign: args.campaign,
    p_platforms: args.platforms,
    p_tasks: args.tasks,
    p_categories: args.categories,
    p_locations: args.locations,
    p_requirements: args.requirements ?? undefined,
    p_campaign_id: meta.data.campaignId ?? undefined,
  });

  if (error || !campaignId) {
    return { status: "error", message: error ? describeDbError(error).message : "The campaign could not be saved." };
  }

  revalidatePath("/campaigns");

  if (meta.data.intent === "continue") {
    const { error: transitionError } = await supabase.rpc("request_campaign_funding", { p_campaign_id: campaignId });
    if (transitionError) return { status: "error", message: describeDbError(transitionError).message };
    redirect(`/campaigns/${campaignId}/fund`);
  }

  return { status: "saved", campaignId, savedAt: new Date().toISOString() };
}

export type CampaignActionState =
  | { status: "idle" }
  | { status: "error"; failure: FundingFailure };

const campaignIdSchema = z.uuid();

/** Moves a complete draft to funding_required (used from the detail page). */
export async function requestFunding(campaignId: string) {
  const id = campaignIdSchema.safeParse(campaignId);
  if (!id.success) redirect("/campaigns");
  const { supabase } = await requireUserId();
  const { error } = await supabase.rpc("request_campaign_funding", { p_campaign_id: id.data });
  if (error) redirect(`/campaigns/${id.data}?error=${encodeURIComponent(describeDbError(error).code)}`);
  redirect(`/campaigns/${id.data}/fund`);
}

export async function cancelCampaign(_previous: CampaignActionState, formData: FormData): Promise<CampaignActionState> {
  const id = campaignIdSchema.safeParse(formData.get("campaignId"));
  const reason = z.string().trim().max(500).catch("").parse(formData.get("reason") ?? "");
  if (!id.success) return { status: "error", failure: { code: "campaign_not_found", message: "Campaign not found." } };

  const { supabase } = await requireUserId();
  const { error } = await supabase.rpc("cancel_campaign", { p_campaign_id: id.data, p_reason: reason || undefined });
  if (error) return { status: "error", failure: describeDbError(error) };

  revalidatePath("/campaigns");
  redirect(`/campaigns/${id.data}`);
}

/**
 * Fund & Publish. The browser sends only the campaign id and an idempotency key;
 * the database recomputes the total, checks ownership, state and balance, and
 * writes the ledger atomically. Retries with the same key never charge twice.
 */
export async function fundCampaign(_previous: CampaignActionState, formData: FormData): Promise<CampaignActionState> {
  const input = z
    .object({ campaignId: z.uuid(), idempotencyKey: z.uuid() })
    .safeParse({ campaignId: formData.get("campaignId"), idempotencyKey: formData.get("idempotencyKey") });
  if (!input.success) {
    return { status: "error", failure: { code: "unknown", message: "Invalid request. Refresh the page and try again." } };
  }

  const { supabase } = await requireUserId();
  const { error } = await supabase.rpc("fund_and_publish_campaign", {
    p_campaign_id: input.data.campaignId,
    p_idempotency_key: input.data.idempotencyKey,
  });

  if (error) return { status: "error", failure: describeDbError(error) };

  revalidatePath("/campaigns");
  revalidatePath("/wallet");
  redirect(`/campaigns/${input.data.campaignId}?funded=1`);
}
