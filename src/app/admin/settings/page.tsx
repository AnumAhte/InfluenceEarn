import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { PLATFORM_FEE_BASIS_POINTS } from "@/domain/pricing";
import { requireAdmin } from "@/features/account/queries";
import { LEGAL_DOCUMENTS_APPROVED } from "@/features/legal/status";
import { getSmtpConfig } from "@/features/notifications/email/config";
import { getPayoutProvider, getWalletFundingProvider } from "@/features/payments/providers";
import { PageHeader } from "@/features/shell/components/page-header";
import { areTestFundsEnabled } from "@/features/wallet/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "System status" };

type Row = { label: string; value: string; tone: StatusTone; detail: string };

/** Read-only launch checklist. Values come from server configuration; nothing here can be changed in the app. */
export default async function AdminSettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [testFunds, feeRefundable] = await Promise.all([areTestFundsEnabled(), supabase.rpc("platform_fee_refundable")]);
  const funding = getWalletFundingProvider();
  const payout = getPayoutProvider();
  const emailReady = Boolean(getSmtpConfig() && process.env.SUPABASE_SECRET_KEY && (process.env.EMAIL_WORKER_SECRET?.length ?? 0) >= 32);

  const rows: Row[] = [
    {
      label: "Campaign funding",
      value: !funding ? "Unavailable" : funding.isTestMode ? "Development mock" : "Connected",
      tone: !funding ? "danger" : funding.isTestMode ? "warning" : "success",
      detail: "Campaigns can be funded and published only with a verified payment provider. None is integrated yet.",
    },
    {
      label: "Creator payouts",
      value: !payout ? "Unavailable" : payout.isTestMode ? "Development mock" : "Connected",
      tone: !payout ? "danger" : payout.isTestMode ? "warning" : "success",
      detail: "Approved work can be released only through a payout provider. None is integrated yet.",
    },
    {
      label: "Test funds (database flag)",
      value: testFunds ? "On" : "Off",
      tone: testFunds ? "warning" : "success",
      detail: "Must be off on any hosted database. Only supabase/seed.sql turns it on, for local development.",
    },
    {
      label: "Notification emails",
      value: emailReady ? "Configured" : "Not configured",
      tone: emailReady ? "success" : "warning",
      detail: "Needs SMTP settings, the Supabase secret key and a worker secret, and a scheduler calling the email endpoint.",
    },
    {
      label: "Platform fee",
      value: `${PLATFORM_FEE_BASIS_POINTS / 100}%`,
      tone: "neutral",
      detail: `Charged on the creator budget at funding. Refunded when a campaign completes: ${feeRefundable.data ? "yes" : "no (needs client confirmation)"}.`,
    },
    {
      label: "Terms and Privacy",
      value: LEGAL_DOCUMENTS_APPROVED ? "Approved" : "Draft",
      tone: LEGAL_DOCUMENTS_APPROVED ? "success" : "warning",
      detail: "Drafts need client and legal approval before launch.",
    },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6">
      <PageHeader title="System status" description="How this environment is configured. Read-only: these are changed in deployment settings, not in the app." />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line-soft">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-col gap-1.5 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-[650]">{row.label}</span>
                <span className="text-[13px] leading-relaxed text-ink-muted">{row.detail}</span>
              </span>
              <StatusBadge tone={row.tone} className="self-start">{row.value}</StatusBadge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
