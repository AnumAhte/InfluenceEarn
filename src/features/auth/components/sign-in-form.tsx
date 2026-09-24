"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, fieldProps } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IDLE, type ActionState } from "@/lib/forms/action-state";

import { signIn } from "../actions";
import type { SignInField } from "../schemas";

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<ActionState<SignInField>, FormData>(signIn, IDLE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status !== "idle" ? (state.values ?? {}) : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {notice && state.status === "idle" ? <Callout tone="warning">{notice}</Callout> : null}
      {state.status === "error" && !state.fieldErrors ? (
        <Callout tone="danger">{state.message}</Callout>
      ) : null}

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="flex flex-col gap-4">
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
        <Field
          id="password"
          label="Password"
          error={errors.password}
          labelAside={
            <Link
              href="/forgot-password"
              className="text-[13px] font-[550] text-primary-strong hover:text-primary-hover"
            >
              Forgot password?
            </Link>
          }
        >
          <Input
            {...fieldProps("password", errors.password)}
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </Field>
      </div>

      <Button type="submit" size="lg" pending={pending} className="w-full shadow-primary">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
