"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";

import { Input, Textarea } from "@/components/ui/input";
import { TASK_RULES, taskLabel } from "@/domain/campaigns/catalog";
import type { CampaignDraftInput } from "@/domain/campaigns/schemas";

import { FieldError, TagInput, WizardSection } from "./fields";

type Errors = Record<string, string | undefined>;

const PROOF_TEXT = {
  required: "Link required",
  optional: "Link if available",
  none: "No link needed",
} as const;

export function StepInstructions({ errors, today }: { errors: Errors; today: string }) {
  const { register, control } = useFormContext<CampaignDraftInput>();
  const tasks = useWatch({ control, name: "tasks" }) ?? [];
  const instructions = useWatch({ control, name: "instructions" }) ?? "";
  const bulletCount = instructions.split("\n").filter((line) => line.trim()).length;

  return (
    <>
      <WizardSection title="Instructions" description="What creators should do, say and tag.">
        <div className="flex flex-col gap-[7px]">
          <label htmlFor="instructions" className="text-[13px] font-semibold">Task instructions</label>
          <Textarea id="instructions" rows={4} {...register("instructions")} placeholder={"Show at least two outfits from the drop\nShoot in daylight"} aria-describedby="instructions-hint" />
          <p id="instructions-hint" className="text-[12.5px] text-ink-muted">Each line becomes a bullet on the campaign page. {bulletCount} so far.</p>
          <FieldError message={errors.instructions} />
        </div>

        <div className="flex flex-col gap-[7px]">
          <label htmlFor="captionInstructions" className="text-[13px] font-semibold">Caption instructions <span className="font-normal text-ink-muted">(optional)</span></label>
          <Textarea id="captionInstructions" rows={3} {...register("captionInstructions")} placeholder="What the caption should mention." />
          <FieldError message={errors.captionInstructions} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="hashtags"
            render={({ field }) => (
              <TagInput id="hashtags" label="Hashtags" prefix="#" values={field.value ?? []} onChange={field.onChange} placeholder="#YourCampaign" error={errors.hashtags ?? firstIndexed(errors, "hashtags")} hint="Press Enter to add." />
            )}
          />
          <Controller
            control={control}
            name="mentions"
            render={({ field }) => (
              <TagInput id="mentions" label="Accounts to tag" prefix="@" values={field.value ?? []} onChange={field.onChange} placeholder="@yourbrand" error={errors.mentions ?? firstIndexed(errors, "mentions")} hint="Handles creators must mention or tag." />
            )}
          />
        </div>

        <div className="flex flex-col gap-[7px]">
          <label htmlFor="referenceUrl" className="text-[13px] font-semibold">Reference link <span className="font-normal text-ink-muted">(optional)</span></label>
          <Input id="referenceUrl" type="url" inputMode="url" placeholder="https://yourbrand.com/campaign-brief" {...register("referenceUrl")} aria-invalid={errors.referenceUrl ? true : undefined} />
          <FieldError message={errors.referenceUrl} />
        </div>
      </WizardSection>

      <WizardSection title="Dates" description="The two deadlines that drive the campaign.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="applicationDeadline" className="text-[13px] font-semibold">Applications close</label>
            <Input id="applicationDeadline" type="date" min={today} {...register("applicationDeadline", { setValueAs: (v: string) => v || null })} aria-invalid={errors.applicationDeadline ? true : undefined} aria-describedby="applicationDeadline-hint" />
            <p id="applicationDeadline-hint" className="text-[12.5px] text-ink-muted">After this date the campaign stops accepting applicants.</p>
            <FieldError message={errors.applicationDeadline} />
          </div>
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="taskDeadline" className="text-[13px] font-semibold">Task deadline</label>
            <Input id="taskDeadline" type="date" min={today} {...register("taskDeadline", { setValueAs: (v: string) => v || null })} aria-invalid={errors.taskDeadline ? true : undefined} aria-describedby="taskDeadline-hint" />
            <p id="taskDeadline-hint" className="text-[12.5px] text-ink-muted">All tasks must be submitted by this date (end of day, UTC).</p>
            <FieldError message={errors.taskDeadline} />
          </div>
        </div>
      </WizardSection>

      <WizardSection title="Completion proof" description="What each creator will submit when they mark a task complete.">
        {tasks.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Add tasks in step 2 to see what creators will submit.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task, index) => {
              const rule = TASK_RULES[task.taskType];
              return (
                <li key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-canvas px-3.5 py-2.5 text-[13.5px]">
                  <span className="font-[550]">{task.quantity} × {taskLabel(task.taskType, task.platform)}</span>
                  <span className="text-ink-secondary">
                    {rule.proofLabel} · {PROOF_TEXT[rule.proofUrl]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[12.5px] text-ink-muted">
          Screenshots are never required. You review every submission yourself before any payment is released.
        </p>
      </WizardSection>
    </>
  );
}

function firstIndexed(errors: Errors, prefix: string) {
  const key = Object.keys(errors).find((k) => k.startsWith(`${prefix}.`));
  return key ? errors[key] : undefined;
}
