import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { requireOnboardedAccount } from "@/features/account/queries";
import { EmailPreferencesForm } from "@/features/notifications/components/email-preferences-form";
import { getMyEmailPreferences } from "@/features/notifications/queries";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "Email preferences" };

export default async function EmailPreferencesPage() {
  const { userId } = await requireOnboardedAccount();
  const preferences = await getMyEmailPreferences(userId);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <PageHeader
        title="Email preferences"
        description="Choose which notifications we also send by email. Everything always appears in your in-app notifications."
      />
      <Card className="px-5 py-6 sm:px-8 sm:py-8">
        <EmailPreferencesForm preferences={preferences} />
      </Card>
      <p className="px-1 text-[13px] leading-relaxed text-ink-muted">
        Emails about your account itself (such as security or suspension notices) are always sent.
      </p>
    </div>
  );
}
