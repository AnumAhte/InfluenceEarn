"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, fieldProps } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IDLE, type ActionState } from "@/lib/forms/action-state";

import { requestPasswordReset } from "../actions";
import type { ForgotPasswordField } from "../schemas";
import { AuthHeading, CheckEmailNotice } from "./auth-card";

export function ForgotPasswordForm() {
  // Remounting the inner form resets its action state ("Use another email").
  const [attempt, setAttempt] = useState(0);
  return <ForgotPasswordInner key={attempt} onRestart={() => setAttempt((n) => n + 1)} />;
}

function ForgotPasswordInner({ onRestart }: { onRestart: () => void }) {
  const [state, action, pending] = useActionState<ActionState<ForgotPasswordField>, FormData>(
    requestPasswordReset,
    IDLE,
  );

  if (state.status === "success") {
    return (
      <CheckEmailNotice
        title="Check your email"
        body="If an account exists for that address, you'll receive a password reset link shortly. The link is valid for a limited time."
        email={state.values?.email}
      >
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Button variant="secondary" className="flex-1" onClick={onRestart}>
            Use another email
          </Button>
          <Button asChild className="flex-1">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </CheckEmailNotice>
    );
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <div className="flex flex-col gap-6">
      <AuthHeading
        title="Reset your password"
        description="Enter the email on your account and we'll send a reset link."
      />
      <form action={action} noValidate className="flex flex-col gap-6">
        {state.status === "error" && !state.fieldErrors ? (
          <Callout tone="danger">{state.message}</Callout>
        ) : null}
        <Field id="email" label="Email" error={errors.email}>
          <Input
            {...fieldProps("email", errors.email)}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            defaultValue={values.email}
            required
          />
        </Field>
        <Button type="submit" size="lg" pending={pending} className="w-full shadow-primary">
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href="/login" className="font-[550] text-primary-strong hover:text-primary-hover">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
