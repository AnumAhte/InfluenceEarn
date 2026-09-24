import type { Metadata } from "next";

import { LOGIN_NOTICE } from "@/features/auth/errors";
import { AuthCard, AuthFooterLink, AuthHeading, AuthLogoLink } from "@/features/auth/components/auth-card";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const errorParam = typeof params.error === "string" ? params.error : undefined;
  const next = nextParam ? safeRedirectPath(nextParam) : undefined;

  return (
    <AuthCard className="max-w-[520px] px-6 py-8 sm:px-11 sm:py-12">
      <div className="flex flex-col gap-6">
        <AuthLogoLink />
        <AuthHeading
          title="Welcome back"
          description="Sign in to manage your campaigns or applications."
        />
        <SignInForm next={next} notice={errorParam ? LOGIN_NOTICE[errorParam] : undefined} />
        <AuthFooterLink prompt="Don't have an account?" href="/signup" label="Create one" />
      </div>
    </AuthCard>
  );
}
