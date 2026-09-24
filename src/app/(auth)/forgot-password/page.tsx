import type { Metadata } from "next";

import { AuthCard, AuthLogoLink } from "@/features/auth/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard className="max-w-[520px] px-6 py-8 sm:px-11 sm:py-12">
      <div className="flex flex-col gap-6">
        <AuthLogoLink />
        <ForgotPasswordForm />
      </div>
    </AuthCard>
  );
}
