import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
// Supabase (bcrypt) ignores bytes beyond 72.
export const PASSWORD_MAX_LENGTH = 72;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: "Email address is too long" })
  .pipe(z.email({ error: "Enter a valid email address" }));

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: `Use at least ${PASSWORD_MIN_LENGTH} characters` })
  .max(PASSWORD_MAX_LENGTH, { error: `Use ${PASSWORD_MAX_LENGTH} characters or fewer` });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Enter your password" }),
  next: z.string().optional(),
});

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { error: "Enter your full name" })
      .max(120, { error: "Name must be 120 characters or fewer" }),
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "Passwords do not match",
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "Passwords do not match",
  });

export type SignInField = "email" | "password";
export type SignUpField = "fullName" | "email" | "password" | "confirmPassword";
export type ForgotPasswordField = "email";
export type ResetPasswordField = "password" | "confirmPassword";
