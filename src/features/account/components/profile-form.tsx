"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useForm, useWatch, type SubmitHandler } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, fieldProps } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { IDLE, type ActionState } from "@/lib/forms/action-state";

import { saveProfile, type ProfileField } from "../actions";
import { profileSchema, type ProfileFormInput, type ProfileValues } from "../schemas";
import { AvatarPicker } from "./avatar-picker";

type ProfileFormProps = {
  intent: "onboarding" | "settings";
  defaults: ProfileFormInput;
  avatarUrl: string | null;
  initials: string;
};

export function ProfileForm({ intent, defaults, avatarUrl, initials }: ProfileFormProps) {
  const [state, formAction, actionPending] = useActionState<ActionState<ProfileField>, FormData>(
    saveProfile,
    IDLE,
  );
  const [transitionPending, startTransition] = useTransition();
  const [avatarError, setAvatarError] = useState<string>();
  const pending = actionPending || transitionPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ProfileFormInput, unknown, ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });

  // After a successful save in settings, the saved values become the new baseline.
  useEffect(() => {
    if (state.status === "success" && state.values) {
      reset(state.values as ProfileFormInput);
    }
  }, [state, reset]);

  const serverErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const errorFor = (field: ProfileField) =>
    (field !== "avatar" ? errors[field]?.message : undefined) ?? serverErrors[field];
  const bioLength = (useWatch({ control, name: "bio" }) ?? "").length;

  // Submit the native form so the optional photo file is included.
  const onValid: SubmitHandler<ProfileValues> = (_values, event) => {
    const form = event?.target;
    if (!(form instanceof HTMLFormElement) || avatarError) return;
    const formData = new FormData(form);
    startTransition(() => formAction(formData));
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onValid)}
      className="flex flex-col gap-6"
      encType="multipart/form-data"
    >
      <input type="hidden" name="intent" value={intent} />

      {state.status === "error" && !state.fieldErrors ? (
        <Callout tone="danger">{state.message}</Callout>
      ) : null}
      {state.status === "success" && intent === "settings" ? (
        <Callout tone="success">
          <span role="status">{state.message}</span>
        </Callout>
      ) : null}

      <AvatarPicker
        initials={initials}
        currentUrl={avatarUrl}
        error={avatarError ?? serverErrors.avatar}
        onValidationChange={setAvatarError}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="fullName" label="Full name" error={errorFor("fullName")}>
          <Input
            {...fieldProps("fullName", errorFor("fullName"))}
            {...register("fullName")}
            autoComplete="name"
          />
        </Field>
        <Field id="phone" label="Phone number" error={errorFor("phone")} hint="Optional">
          <Input
            {...fieldProps("phone", errorFor("phone"), true)}
            {...register("phone")}
            type="tel"
            autoComplete="tel"
            placeholder="+1 555 010 0000"
          />
        </Field>
      </div>

      <Field id="city" label="City" error={errorFor("city")} hint="Optional">
        <Input
          {...fieldProps("city", errorFor("city"), true)}
          {...register("city")}
          autoComplete="address-level2"
          placeholder="Where you're based"
        />
      </Field>

      <Field
        id="bio"
        label="Short bio"
        error={errorFor("bio")}
        labelAside={
          <span className="tabular text-[12.5px] text-ink-muted" aria-live="polite">
            Optional · {bioLength}/160
          </span>
        }
      >
        <Textarea
          {...fieldProps("bio", errorFor("bio"))}
          {...register("bio")}
          maxLength={160}
          placeholder="A line about you or your brand."
        />
      </Field>

      <div className="flex flex-col-reverse items-stretch justify-between gap-4 pt-2 sm:flex-row sm:items-center">
        <p className="max-w-[340px] text-[13px] leading-normal text-ink-muted">
          Social accounts are not needed yet. You&apos;ll be asked only when a campaign requires one.
        </p>
        <Button
          type="submit"
          size="lg"
          pending={pending}
          className="shadow-primary"
        >
          {pending ? "Saving…" : intent === "onboarding" ? "Finish setup" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
