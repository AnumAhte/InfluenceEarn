"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, fieldProps } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IDLE, type ActionState } from "@/lib/forms/action-state";

import { updatePassword } from "../actions";
import { PASSWORD_MIN_LENGTH, type ResetPasswordField } from "../schemas";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<ActionState<ResetPasswordField>, FormData>(
    updatePassword,
    IDLE,
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {state.status === "error" && !state.fieldErrors ? (
        <Callout tone="danger">{state.message}</Callout>
      ) : null}
      <div className="flex flex-col gap-4">
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
          <Input
            {...fieldProps("confirmPassword", errors.confirmPassword)}
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter password"
            required
          />
        </Field>
      </div>
      <Button type="submit" size="lg" pending={pending} className="w-full shadow-primary">
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
