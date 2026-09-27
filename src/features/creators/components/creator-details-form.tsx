"use client";

import { useActionState, useState } from "react";

import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { CATEGORIES, CREATOR_GENDERS, GENDER_LABELS, type CategorySlug } from "@/domain/campaigns/catalog";
import { countryOptions } from "@/domain/geo/countries";
import { IDLE, type ActionState } from "@/lib/forms/action-state";
import { cn } from "@/lib/utils/cn";

import { saveCreatorDetails, type CreatorField } from "../actions";
import type { CreatorDetails } from "../queries";

const COUNTRIES = countryOptions();

/** Private eligibility details. Advertisers only see an application snapshot (age, not date of birth). */
export function CreatorDetailsForm({ details, maxBirthDate }: { details: CreatorDetails; maxBirthDate: string }) {
  const [state, action] = useActionState<ActionState<CreatorField>, FormData>(saveCreatorDetails, IDLE);
  const [categories, setCategories] = useState<CategorySlug[]>(details.categories);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {state.status === "error" && !state.fieldErrors ? <Callout tone="danger">{state.message}</Callout> : null}
      {state.status === "success" ? <Callout tone="success"><span role="status">{state.message}</span></Callout> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="countryCode" label="Country" error={errors.countryCode} hint="Used for campaigns that target a location.">
          <Select id="countryCode" name="countryCode" defaultValue={details.countryCode ?? ""} aria-describedby="countryCode-hint">
            <option value="">Not set</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field id="dateOfBirth" label="Date of birth" error={errors.dateOfBirth} hint="Private. Advertisers only see your age.">
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            max={maxBirthDate}
            defaultValue={details.dateOfBirth ?? ""}
            aria-invalid={errors.dateOfBirth ? true : undefined}
            aria-describedby={errors.dateOfBirth ? "dateOfBirth-error" : "dateOfBirth-hint"}
          />
        </Field>
      </div>

      <Field id="gender" label="Gender" error={errors.gender} hint="Only needed for campaigns aimed at a specific audience.">
        <Select id="gender" name="gender" defaultValue={details.gender ?? ""} aria-describedby="gender-hint">
          <option value="">Prefer not to say</option>
          {CREATOR_GENDERS.map((g) => (
            <option key={g} value={g}>{GENDER_LABELS[g]}</option>
          ))}
        </Select>
      </Field>

      <fieldset className="flex flex-col gap-[9px]">
        <legend className="mb-[9px] text-[13px] font-[550]">What do you create?</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => {
            const on = categories.includes(category.slug);
            return (
              <label
                key={category.slug}
                className={cn(
                  "flex h-[38px] cursor-pointer items-center rounded-full border px-3.5 text-[13.5px] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
                  on ? "border-primary-strong bg-primary-strong font-semibold text-white" : "border-line bg-surface hover:bg-canvas",
                )}
              >
                <input
                  type="checkbox"
                  name="categories"
                  value={category.slug}
                  checked={on}
                  onChange={() =>
                    setCategories((current) => (on ? current.filter((c) => c !== category.slug) : [...current, category.slug]))
                  }
                  className="sr-only"
                />
                {category.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton size="lg" pendingLabel="Saving…" className="shadow-primary">
          Save creator details
        </SubmitButton>
      </div>
    </form>
  );
}
