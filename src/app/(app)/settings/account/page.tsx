import type { Metadata } from "next";

import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { requireOnboardedAccount } from "@/features/account/queries";
import { ChangeEmailForm, ChangePasswordForm } from "@/features/auth/components/account-security-forms";
import { PageHeader } from "@/features/shell/components/page-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account & security" };

export default async function AccountSettingsPage({ searchParams }: PageProps<"/settings/account">) {
  await requireOnboardedAccount();
  const { notice } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? "";
  const pendingEmail = data.user?.new_email ?? null;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <PageHeader title="Account & security" description="Your sign-in email address and password." />
      {notice === "email_confirmed" ? (
        <Callout tone="success">
          <span role="status">Confirmation received. If you&apos;ve confirmed from both addresses, your new email is now active.</span>
        </Callout>
      ) : null}

      <Card className="flex flex-col gap-4 px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-[650] tracking-[-0.01em]">Email address</h2>
          <p className="text-[13.5px] text-ink-secondary">
            Signed in as <span className="font-[550] text-ink">{email}</span>
          </p>
          {pendingEmail ? (
            <p className="text-[13px] text-warning-fg">Waiting for confirmation of {pendingEmail}.</p>
          ) : null}
        </div>
        <ChangeEmailForm />
      </Card>

      <Card className="flex flex-col gap-4 px-5 py-6 sm:px-8 sm:py-8">
        <h2 className="text-[17px] font-[650] tracking-[-0.01em]">Password</h2>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
