import type { Metadata } from "next";

import { AuthCard, AuthHeading, AuthLogoLink } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the recovery email via /auth/confirm, which signs the user in first.
// Signed-out visitors are redirected to /forgot-password by the proxy.
export default function ResetPasswordPage() {
  return (
    <AuthCard className="max-w-[520px] px-6 py-8 sm:px-11 sm:py-12">
      <div className="flex flex-col gap-6">
        <AuthLogoLink />
        <AuthHeading
          title="Choose a new password"
          description="Use at least 8 characters. You'll stay signed in on this device."
        />
        <ResetPasswordForm />
      </div>
    </AuthCard>
  );
}
