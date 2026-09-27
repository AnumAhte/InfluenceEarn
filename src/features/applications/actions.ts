"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { APPLICATION_ACTIONS } from "@/domain/applications/state-machine";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";

import { describeApplicationError, type ApplicationFailure } from "./errors";

export type ApplyState = { status: "idle" } | { status: "error"; failure: ApplicationFailure };

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  return supabase;
}

/** Applies to a campaign. Eligibility is enforced by the database function. */
export async function applyToCampaign(_previous: ApplyState, formData: FormData): Promise<ApplyState> {
  const input = z
    .object({ campaignId: z.uuid(), pitch: z.string().trim().max(1000, { error: "Keep your message under 1,000 characters" }) })
    .safeParse({ campaignId: formData.get("campaignId"), pitch: formData.get("pitch") ?? "" });
  if (!input.success) {
    return { status: "error", failure: { code: "unknown", message: input.error.issues[0]?.message ?? "Invalid request." } };
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("apply_to_campaign", {
    p_campaign_id: input.data.campaignId,
    p_pitch: input.data.pitch || undefined,
  });
  if (error) return { status: "error", failure: describeApplicationError(error) };

  revalidatePath("/discover");
  revalidatePath("/applications");
  redirect(`/discover/${input.data.campaignId}?applied=1`);
}

export type DecideState = { status: "idle" } | { status: "error"; message: string };

/** Advertiser's manual decision on one application (owner-only, enforced in the database). */
export async function decideApplication(_previous: DecideState, formData: FormData): Promise<DecideState> {
  const input = z
    .object({ applicationId: z.uuid(), action: z.enum(APPLICATION_ACTIONS), campaignId: z.uuid() })
    .safeParse({
      applicationId: formData.get("applicationId"),
      action: formData.get("action"),
      campaignId: formData.get("campaignId"),
    });
  if (!input.success) return { status: "error", message: "Invalid request." };

  const supabase = await requireUser();
  const { error } = await supabase.rpc("decide_application", {
    p_application_id: input.data.applicationId,
    p_action: input.data.action,
  });
  if (error) return { status: "error", message: describeApplicationError(error).message };

  revalidatePath(`/campaigns/${input.data.campaignId}`, "layout");
  return { status: "idle" };
}

/** applications_open → selection_in_progress. */
export async function closeApplications(formData: FormData) {
  const input = z
    .object({ campaignId: z.uuid(), returnTo: z.string().optional() })
    .safeParse({ campaignId: formData.get("campaignId"), returnTo: formData.get("returnTo") ?? undefined });
  if (!input.success) redirect("/campaigns");

  const supabase = await requireUser();
  const { error } = await supabase.rpc("close_campaign_applications", { p_campaign_id: input.data.campaignId });
  const back = safeRedirectPath(input.data.returnTo, `/campaigns/${input.data.campaignId}`);
  if (error) redirect(`${back}${back.includes("?") ? "&" : "?"}error=invalid_campaign_state`);

  revalidatePath("/campaigns", "layout");
  redirect(back);
}
