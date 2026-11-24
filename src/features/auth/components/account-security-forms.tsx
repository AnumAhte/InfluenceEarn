"use client";

import { useActionState } from "react";

import { Callout } from "@/components/ui/callout";
import { Field, fieldProps } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { IDLE, type ActionState } from "@/lib/forms/action-state";

import { changeEmail, changePassword } from "../actions";
import { PASSWORD_MIN_LENGTH, type ChangeEmailField, type ChangePasswordField } from "../schemas";

function FormNotice({ state }: { state: ActionState<string> }) {
  if (state.status === "success") return <Callout tone="success"><span role="status">{state.message}</span></Callout>;
  if (state.status === "error" && !state.fieldErrors) return <Callout tone="danger">{state.message}</Callout>;
  return null;
}

export function ChangeEmailForm() {
  const [state, action] = useActionState<ActionState<ChangeEmailField>, FormData>(changeEmail, IDLE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormNotice state={state} />
      <Field id="email" label="New email address" error={errors.email}>
        <Input {...fieldProps("email", errors.email)} type="email" autoComplete="email" required />
      </Field>
      <div>
        <SubmitButton pendingLabel="Sending…">Change email</SubmitButton>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<ActionState<ChangePasswordField>, FormData>(changePassword, IDLE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={action} noValidate className="flex flex-col gap-4" key={state.status === "success" ? "done" : "form"}>
      <FormNotice state={state} />
      <Field id="currentPassword" label="Current password" error={errors.currentPassword}>
        <Input {...fieldProps("currentPassword", errors.currentPassword)} type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="password" label="New password" error={errors.password}>
          <Input
            {...fieldProps("password", errors.password)}
            type="password"
            autoComplete="new-password"
            placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
        </Field>
        <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword}>
          <Input {...fieldProps("confirmPassword", errors.confirmPassword)} type="password" autoComplete="new-password" required />
        </Field>
      </div>
      <div>
        <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
      </div>
    </form>
  );
}
