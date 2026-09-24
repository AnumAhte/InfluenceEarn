import { Check } from "lucide-react";
import type { Metadata } from "next";

import { AuthCard, AuthLogoLink } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

const POINTS = [
  "Campaigns are funded before they go live",
  "Requirements are set by the advertiser, upfront",
  "One account, both roles, no second login",
] as const;

export default function SignUpPage() {
  return (
    <AuthCard className="grid max-w-[1120px] overflow-hidden lg:grid-cols-[420px_1fr]">
      <aside className="flex flex-col gap-4 bg-night px-6 pt-6 pb-7 lg:gap-8 lg:px-9 lg:py-10">
        <AuthLogoLink theme="dark" />
        <div className="flex flex-col gap-3.5 lg:mt-6">
          <p className="text-[19px] leading-[1.3] font-bold tracking-[-0.02em] text-white lg:text-2xl lg:leading-[1.25]">
            Campaigns built around real work.
          </p>
          <p className="hidden text-[14.5px] leading-relaxed text-ink-subtle lg:block">
            Built for brands, agencies, and creators worldwide.
          </p>
        </div>
        <ul className="mt-2 hidden flex-col gap-4 lg:flex">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-ink-disabled">
              <Check aria-hidden className="mt-1 size-3.5 flex-none text-success" strokeWidth={3} />
              {point}
            </li>
          ))}
        </ul>
        <p className="mt-auto hidden border-t border-white/10 pt-5 text-[13px] leading-relaxed text-ink-subtle lg:block">
          Takes under a minute. You only add a phone number and city after your first login.
        </p>
      </aside>
      <div className="flex flex-col justify-center px-6 py-7 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
        <SignUpForm />
      </div>
    </AuthCard>
  );
}
