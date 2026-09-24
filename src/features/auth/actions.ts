"use server";

import { redirect } from "next/navigation";

import { getPublicEnv } from "@/lib/env";
import { firstFieldErrors, formString, type ActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";

import { authErrorMessage } from "./errors";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordField,
  type ResetPasswordField,
  type SignInField,
  type SignUpField,
} from "./schemas";

export async function signIn(
  _previous: ActionState<SignInField>,
  formData: FormData,
): Promise<ActionState<SignInField>> {
  const parsed = signInSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    next: formString(formData, "next") || undefined,
  });
  const values = { email: formString(formData, "email") };

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors<SignInField>(parsed.error),
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { status: "error", message: authErrorMessage(error.code, "Email or password is incorrect."), values };
  }

  redirect(safeRedirectPath(parsed.data.next, "/dashboard"));
}

export async function signUp(
  _previous: ActionState<SignUpField>,
  formData: FormData,
): Promise<ActionState<SignUpField>> {
  const values = { fullName: formString(formData, "fullName"), email: formString(formData, "email") };
  const parsed = signUpSchema.safeParse({
    ...values,
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors<SignUpField>(parsed.error),
      values,
    };
  }

  const { siteUrl } = getPublicEnv();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/onboarding/role`,
    },
  });

  if (error) {
    return { status: "error", message: authErrorMessage(error.code), values };
  }

  // Email confirmation disabled (e.g. local development): the user is signed in already.
  if (data.session) redirect("/onboarding/role");

  // Same response whether or not the address was already registered (no account enumeration).
  return {
    status: "success",
    message: "Check your email for a link to confirm your account.",
    values: { email: parsed.data.email },
  };
}

export async function requestPasswordReset(
  _previous: ActionState<ForgotPasswordField>,
  formData: FormData,
): Promise<ActionState<ForgotPasswordField>> {
  const values = { email: formString(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: firstFieldErrors<ForgotPasswordField>(parsed.error),
      values,
    };
  }

  const { siteUrl } = getPublicEnv();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });

  // Only surface rate limiting; anything else would reveal whether the account exists.
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { status: "error", message: authErrorMessage(error.code), values };
  }

  return {
    status: "success",
    message: "If an account exists for that email, we've sent a password reset link.",
    values: { email: parsed.data.email },
  };
}

export async function updatePassword(
  _previous: ActionState<ResetPasswordField>,
  formData: FormData,
): Promise<ActionState<ResetPasswordField>> {
  const parsed = resetPasswordSchema.safeParse({
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors<ResetPasswordField>(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { status: "error", message: authErrorMessage(error.code) };

  redirect("/dashboard?notice=password_updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
