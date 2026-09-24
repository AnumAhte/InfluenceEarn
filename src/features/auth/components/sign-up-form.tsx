"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, fieldProps } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IDLE, type ActionState } from "@/lib/forms/action-state";

import { signUp } from "../actions";
import { PASSWORD_MIN_LENGTH, type SignUpField } from "../schemas";
import { AuthFooterLink, AuthHeading, CheckEmailNotice } from "./auth-card";

export function SignUpForm() {
  const [state, action, pending] = useActionState<ActionState<SignUpField>, FormData>(signUp, IDLE);

  if (state.status === "success") {
    return (
      <CheckEmailNotice
        title="Check your email"
        body="We've sent a link to confirm your email address. Open it to finish creating your account."
        email={state.values?.email}
      >
        <AuthFooterLink prompt="Already confirmed?" href="/login" label="Sign in" />
      </CheckEmailNotice>
    );
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <div className="flex flex-col gap-6">
      <AuthHeading
        title="Create your account"
        description="One account for brands and creators. Switch roles whenever you need."
      />

      <form action={action} noValidate className="flex flex-col gap-6">
        {state.status === "error" && !state.fieldErrors ? (
          <Callout tone="danger">{state.message}</Callout>
        ) : null}

        <div className="flex flex-col gap-4">
          <Field id="fullName" label="Full name" error={errors.fullName}>
            <Input
              {...fieldProps("fullName", errors.fullName)}
              autoComplete="name"
              placeholder="Your full name"
              defaultValue={values.fullName}
              required
            />
          </Field>
          <Field id="email" label="Email address" error={errors.email}>
            <Input
              {...fieldProps("email", errors.email)}
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              defaultValue={values.email}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="password" label="Password" error={errors.password}>
              <Input
                {...fieldProps("password", errors.password)}
                type="password"
                autoComplete="new-password"
                placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                minLength={PASSWORD_MIN_LENGTH}
                required
              />
            </Field>
            <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
              <Input
                {...fieldProps("confirmPassword", errors.confirmPassword)}
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter password"
                required
              />
            </Field>
          </div>
        </div>

        <Callout>You can connect your social accounts later when you apply to campaigns.</Callout>

        <Button type="submit" size="lg" pending={pending} className="w-full shadow-primary">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <AuthFooterLink prompt="Already have an account?" href="/login" label="Sign in" />
    </div>
  );
}
