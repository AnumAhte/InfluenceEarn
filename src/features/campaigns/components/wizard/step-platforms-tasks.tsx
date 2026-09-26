"use client";

import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  PLATFORM_META,
  SOCIAL_PLATFORMS,
  TASK_RULES,
  taskLabel,
  taskTypesForPlatform,
  type SocialPlatform,
  type TaskType,
} from "@/domain/campaigns/catalog";
import type { CampaignDraftInput } from "@/domain/campaigns/schemas";
import { cn } from "@/lib/utils/cn";

import { PlatformTile } from "../campaign-bits";
import { FieldError, WizardSection } from "./fields";

type Errors = Record<string, string | undefined>;

export function StepPlatformsTasks({ errors }: { errors: Errors }) {
  const { control, setValue, register, getValues } = useFormContext<CampaignDraftInput>();
  const platforms = useWatch({ control, name: "platforms" }) ?? [];
  const tasks = useWatch({ control, name: "tasks" }) ?? [];
  const taskArray = useFieldArray({ control, name: "tasks" });
  const [note, setNote] = useState("");

  function togglePlatform(platform: SocialPlatform) {
    if (platforms.includes(platform)) {
      const remaining = getValues("tasks").filter((task) => task.platform !== platform);
      const dropped = getValues("tasks").length - remaining.length;
      setValue("platforms", platforms.filter((p) => p !== platform), { shouldDirty: true });
      taskArray.replace(remaining);
      setNote(dropped ? `${dropped} ${dropped === 1 ? "task was" : "tasks were"} removed with ${PLATFORM_META[platform].label}.` : "");
    } else {
      setValue("platforms", [...platforms, platform], { shouldDirty: true });
      setNote("");
    }
  }

  function addTask() {
    const platform = platforms[0] ?? "instagram";
    if (!platforms.includes(platform)) setValue("platforms", [platform], { shouldDirty: true });
    taskArray.append({ platform, taskType: taskTypesForPlatform(platform)[0] ?? "custom", quantity: 1 });
  }

  const deliverables = tasks.reduce((sum, task) => sum + (Number(task.quantity) || 0), 0);

  return (
    <WizardSection title="Platforms & tasks" description="Where the content goes, and exactly what each selected creator has to do.">
      <fieldset className="flex flex-col gap-[9px]">
        <legend className="mb-[9px] text-[13px] font-semibold">Platforms</legend>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {SOCIAL_PLATFORMS.map((platform) => {
            const on = platforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                aria-pressed={on}
                onClick={() => togglePlatform(platform)}
                className={cn(
                  "flex cursor-pointer items-center gap-[11px] rounded-[14px] border px-3.5 py-[13px] text-left",
                  on ? "border-primary bg-primary-100" : "border-line bg-surface hover:bg-canvas",
                )}
              >
                <PlatformTile platform={platform} active={on} size="md" />
                <span className="flex min-w-0 flex-col gap-px">
                  <span className={cn("text-[13.5px] font-semibold", on ? "text-primary-hover" : "text-ink")}>{PLATFORM_META[platform].label}</span>
                  <span className="text-xs text-ink-muted">{PLATFORM_META[platform].reach}</span>
                </span>
                {on ? <Check aria-hidden className="ml-auto size-4 flex-none text-primary" strokeWidth={3} /> : null}
              </button>
            );
          })}
        </div>
        <FieldError message={errors.platforms} />
      </fieldset>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-semibold">Tasks per creator</h3>
          <span className="text-[12.5px] text-ink-muted">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"} · {deliverables} {deliverables === 1 ? "deliverable" : "deliverables"} per creator
          </span>
        </div>

        {taskArray.fields.length > 0 ? (
          <ul className="overflow-hidden rounded-[14px] border border-line">
            {taskArray.fields.map((field, index) => {
              const task = tasks[index] ?? field;
              const rule = TASK_RULES[task.taskType as TaskType];
              return (
                <li key={field.id} className="flex flex-col gap-2.5 border-b border-line-soft px-3.5 py-3 last:border-b-0">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1fr_1.3fr_90px_44px]">
                    <Select
                      aria-label={`Task ${index + 1} platform`}
                      {...register(`tasks.${index}.platform`, {
                        onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                          const platform = event.target.value as SocialPlatform;
                          setValue(`tasks.${index}.taskType`, taskTypesForPlatform(platform)[0] ?? "custom");
                        },
                      })}
                    >
                      {(platforms.length ? platforms : SOCIAL_PLATFORMS).map((p) => (
                        <option key={p} value={p}>{PLATFORM_META[p].label}</option>
                      ))}
                    </Select>
                    <Select aria-label={`Task ${index + 1} type`} {...register(`tasks.${index}.taskType`)}>
                      {taskTypesForPlatform(task.platform).map((type) => (
                        <option key={type} value={type}>{taskLabel(type, task.platform)}</option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      aria-label={`Task ${index + 1} quantity`}
                      {...register(`tasks.${index}.quantity`, { valueAsNumber: true })}
                    />
                    <button
                      type="button"
                      onClick={() => taskArray.remove(index)}
                      aria-label={`Remove task ${index + 1}`}
                      className="flex size-11 cursor-pointer items-center justify-center justify-self-end rounded-[10px] border border-line text-ink-secondary hover:border-danger-border hover:bg-danger-bg hover:text-danger-fg"
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  </div>
                  {task.taskType === "custom" ? (
                    <Input
                      aria-label={`Task ${index + 1} description`}
                      placeholder="Describe the custom task"
                      {...register(`tasks.${index}.customDescription`)}
                    />
                  ) : null}
                  <p className="text-xs text-ink-muted">
                    Proof: {rule?.proofLabel ?? "—"}
                    {rule?.proofUrl === "optional" ? " · link optional" : ""}
                  </p>
                  <FieldError
                    message={
                      errors[`tasks.${index}.platform`] ??
                      errors[`tasks.${index}.taskType`] ??
                      errors[`tasks.${index}.quantity`] ??
                      errors[`tasks.${index}.customDescription`]
                    }
                  />
                </li>
              );
            })}
          </ul>
        ) : null}

        <div>
          <Button type="button" variant="secondary" size="sm" onClick={addTask} disabled={taskArray.fields.length >= 50}>
            <Plus aria-hidden className="size-4" />
            Add task
          </Button>
        </div>
        <p className="text-[12.5px] text-ink-muted">Each selected creator completes every task. Screenshots are never required.</p>
        {note ? <Callout tone="neutral"><span role="status">{note}</span></Callout> : null}
        <FieldError message={errors.tasks} />
      </div>
    </WizardSection>
  );
}
