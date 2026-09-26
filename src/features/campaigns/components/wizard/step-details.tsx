"use client";

import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CAMPAIGN_TYPE_META,
  CAMPAIGN_TYPES,
  CATEGORIES,
  CREATOR_GENDERS,
  GENDER_LABELS,
  type CreatorGender,
} from "@/domain/campaigns/catalog";
import type { CampaignDraftInput } from "@/domain/campaigns/schemas";
import { countryOptions } from "@/domain/geo/countries";
import { cn } from "@/lib/utils/cn";

import { ChipGroup, FieldError, WizardSection } from "./fields";

const FOLLOWER_OPTIONS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
const COUNTRIES = countryOptions();

type Errors = Record<string, string | undefined>;

function toNumberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export function StepDetails({ errors }: { errors: Errors }) {
  const { register, control, setValue } = useFormContext<CampaignDraftInput>();
  const [description, categorySlug, campaignType, genders, creatorCategories] = useWatch({
    control,
    name: ["description", "categorySlug", "campaignType", "eligibility.genders", "eligibility.creatorCategories"],
  });
  const locations = useFieldArray({ control, name: "eligibility.locations" });

  return (
    <>
      <WizardSection title="Campaign details" description="What the campaign is, and who it is open to.">
        <div className="flex flex-col gap-[7px]">
          <label htmlFor="title" className="text-[13px] font-semibold">Campaign name</label>
          <Input id="title" {...register("title")} placeholder="e.g. Winter Collection Launch" aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? "title-error" : undefined} />
          <FieldError id="title-error" message={errors.title} />
        </div>

        <div className="flex flex-col gap-[7px]">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="description" className="text-[13px] font-semibold">Description</label>
            <span className="tabular text-xs text-ink-muted" aria-live="polite">{(description ?? "").length} characters</span>
          </div>
          <Textarea
            id="description"
            rows={4}
            {...register("description")}
            placeholder="Describe the campaign, the brand, and what you want creators to communicate."
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? "description-error" : undefined}
          />
          <FieldError id="description-error" message={errors.description} />
        </div>

        <ChipGroup
          label="Category"
          options={CATEGORIES.map((c) => ({ value: c.slug, label: c.label }))}
          selected={categorySlug ? [categorySlug] : []}
          onToggle={(value) => setValue("categorySlug", value, { shouldDirty: true })}
          error={errors.categorySlug}
        />

        <fieldset className="flex flex-col gap-[9px]">
          <legend className="mb-[9px] text-[13px] font-semibold">Campaign type</legend>
          <div role="radiogroup" aria-label="Campaign type" className="grid gap-2.5 sm:grid-cols-2">
            {CAMPAIGN_TYPES.map((type) => {
              const on = campaignType === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setValue("campaignType", type, { shouldDirty: true })}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-[14px] border px-4 py-3.5 text-left",
                    on ? "border-primary bg-primary-100" : "border-line bg-surface hover:bg-canvas",
                  )}
                >
                  <span className={cn("text-sm font-semibold", on ? "text-primary-hover" : "text-ink")}>{CAMPAIGN_TYPE_META[type].label}</span>
                  <span className="text-[12.5px] leading-normal text-ink-muted">{CAMPAIGN_TYPE_META[type].hint}</span>
                </button>
              );
            })}
          </div>
          <FieldError message={errors.campaignType} />
        </fieldset>
      </WizardSection>

      <WizardSection title="Who can apply" description="All optional. Leave anything empty to accept every creator.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="minFollowers" className="text-[13px] font-semibold">Minimum followers</label>
            <Select
              id="minFollowers"
              {...register("eligibility.minFollowers", { setValueAs: (v: string) => toNumberOrNull(v) })}
            >
              <option value="">No minimum</option>
              {FOLLOWER_OPTIONS.map((n) => (
                <option key={n} value={n}>{n.toLocaleString("en-US")}</option>
              ))}
            </Select>
            <p className="text-[12.5px] text-ink-muted">Checked by you against the creator&apos;s linked account.</p>
          </div>
          <div className="flex flex-col gap-[7px]">
            <span className="text-[13px] font-semibold" id="age-label">Age range</span>
            <div className="flex items-center gap-2" role="group" aria-labelledby="age-label">
              <Input type="number" inputMode="numeric" min={13} max={100} placeholder="Min" aria-label="Minimum age" {...register("eligibility.ageMin", { setValueAs: (v: string) => toNumberOrNull(v) })} />
              <span aria-hidden className="text-ink-muted">–</span>
              <Input type="number" inputMode="numeric" min={13} max={100} placeholder="Max" aria-label="Maximum age" {...register("eligibility.ageMax", { setValueAs: (v: string) => toNumberOrNull(v) })} />
            </div>
            <FieldError message={errors["eligibility.ageMin"] ?? errors["eligibility.ageMax"]} />
          </div>
        </div>

        <ChipGroup<CreatorGender>
          label="Gender"
          multiple
          options={CREATOR_GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
          selected={genders ?? []}
          onToggle={(value) =>
            setValue("eligibility.genders", (genders ?? []).includes(value) ? genders.filter((g) => g !== value) : [...(genders ?? []), value], { shouldDirty: true })
          }
          hint="None selected means any gender."
        />

        <ChipGroup
          label="Creator category"
          multiple
          options={CATEGORIES.map((c) => ({ value: c.slug, label: c.label }))}
          selected={creatorCategories ?? []}
          onToggle={(value) =>
            setValue(
              "eligibility.creatorCategories",
              (creatorCategories ?? []).includes(value) ? creatorCategories.filter((c) => c !== value) : [...(creatorCategories ?? []), value],
              { shouldDirty: true },
            )
          }
          hint="None selected means any category."
        />

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-[13px] font-semibold">Location</legend>
          {locations.fields.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Open to creators anywhere.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {locations.fields.map((field, index) => (
                <li key={field.id} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.2fr_1fr_auto]">
                  <Select aria-label={`Country ${index + 1}`} {...register(`eligibility.locations.${index}.countryCode`)}>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </Select>
                  <Input
                    aria-label={`City ${index + 1} (optional)`}
                    placeholder="City (optional)"
                    className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
                    {...register(`eligibility.locations.${index}.city`)}
                  />
                  <button
                    type="button"
                    onClick={() => locations.remove(index)}
                    aria-label={`Remove location ${index + 1}`}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-control border border-line text-ink-secondary hover:border-danger-border hover:bg-danger-bg hover:text-danger-fg"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                  <FieldError message={errors[`eligibility.locations.${index}.countryCode`]} />
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => locations.append({ countryCode: "US", city: "", region: "" })} disabled={locations.fields.length >= 20}>
              <Plus aria-hidden className="size-4" />
              Add location
            </Button>
          </div>
        </fieldset>
      </WizardSection>
    </>
  );
}
