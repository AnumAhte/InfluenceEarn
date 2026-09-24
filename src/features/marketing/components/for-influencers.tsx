import { Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { Container, ExampleTag, SectionHeading } from "./section";

const BENEFITS = [
  "Payment per influencer shown before you apply",
  "Only campaigns already funded by the advertiser",
  "Payment released by the agency after approval",
  "No joining fee and no subscription",
] as const;

// Illustrative earnings panel; tagged "Example".
const EXAMPLE_EARNINGS = [
  { title: "Winter knit drop", detail: "Instagram Reel · approved, payment released", amount: "$350", tone: "text-success-fg" },
  { title: "Pantry staples bundle", detail: "TikTok video · submitted, in review", amount: "$400", tone: "text-warning-fg" },
  { title: "Coffee house launch", detail: "Instagram Story · approved, payment released", amount: "$225", tone: "text-success-fg" },
] as const;

export function ForInfluencers() {
  return (
    <section id="creators" aria-labelledby="creators-title" className="scroll-mt-16 border-t border-line bg-surface">
      <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-5">
          <SectionHeading
            id="creators-title"
            eyebrow="For influencers"
            title="Apply only to campaigns you qualify for."
            description="Signing up is free and needs no social accounts. Connect the platform a campaign asks for, apply, complete the task and submit your link."
          />
          <ul className="mt-1 flex flex-col gap-3.5">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 text-[15px] leading-normal text-ink-secondary">
                <Check aria-hidden className="mt-0.5 size-4 flex-none text-success" strokeWidth={3} />
                {benefit}
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <Button asChild size="lg" className="shadow-primary">
              <Link href="/signup">Create an influencer account</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-card border border-line bg-canvas p-5 shadow-[0_24px_60px_-32px_rgba(8,32,31,0.14)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold">Earnings</span>
            <ExampleTag />
          </div>
          <div className="flex flex-col gap-1">
            <span className="tabular text-[32px] font-bold tracking-[-0.03em]">$575</span>
            <span className="text-[13px] text-success-fg">$400 awaiting advertiser approval</span>
          </div>
          <ul className="overflow-hidden rounded-[14px] border border-line bg-surface">
            {EXAMPLE_EARNINGS.map((row) => (
              <li
                key={row.title}
                className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3.5 last:border-b-0"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13.5px] font-[550]">{row.title}</span>
                  <span className="text-xs text-ink-muted">{row.detail}</span>
                </span>
                <span className={`tabular text-[13.5px] font-semibold ${row.tone}`}>{row.amount}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2.5 rounded-control bg-surface-muted px-3.5 py-3 text-[13px] leading-normal text-ink">
            <span aria-hidden className="size-1.5 flex-none rounded-full bg-primary" />
            Payments are released by the agency once the advertiser approves
          </p>
        </div>
      </Container>
    </section>
  );
}
