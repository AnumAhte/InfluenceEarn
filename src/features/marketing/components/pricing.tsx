import { Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/domain/money";
import { calculateCampaignFunding } from "@/domain/pricing";
import { cn } from "@/lib/utils/cn";

import { WORKED_EXAMPLE } from "./payment-flow";
import { Container, SectionHeading } from "./section";

type Plan = {
  name: string;
  price: string;
  unit?: string;
  summary: string;
  points: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
};

export function Pricing() {
  const { creators, paymentPerCreator } = WORKED_EXAMPLE;
  const funding = calculateCampaignFunding(paymentPerCreator, creators);
  const money = (value: Parameters<typeof formatMoney>[0]) => formatMoney(value, { showCents: false });

  const plans: Plan[] = [
    {
      name: "Advertisers",
      price: "20%",
      unit: "platform fee",
      summary: "Debited from your wallet once, at publishing.",
      points: [
        "Set your own payment per influencer",
        "Campaign published only after funding",
        "Choose how many influencers you need",
        "Select applicants manually",
      ],
      cta: "Start a campaign",
    },
    {
      name: "Influencers",
      price: "$0",
      unit: "to join and apply",
      summary: "You keep the full payment set by the advertiser.",
      points: [
        "Free account, no subscription",
        "No social accounts needed to sign up",
        "Apply to any campaign you qualify for",
        "Payment released after approval",
        "Switch back to Advertiser anytime",
      ],
      cta: "Create an influencer account",
      highlighted: true,
      badge: "Free to join",
    },
    {
      name: "Worked example",
      price: money(funding.totalFunding),
      summary: `What a ${creators}-influencer campaign costs to publish.`,
      points: [
        `${creators} influencers × ${money(paymentPerCreator)} = ${money(funding.creatorBudget)}`,
        `Platform fee 20% = ${money(funding.platformFee)}`,
        `Debited from wallet at publishing = ${money(funding.totalFunding)}`,
        `Each influencer receives ${money(paymentPerCreator)}`,
      ],
      cta: "Create an account",
    },
  ];

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-16 border-t border-line bg-canvas">
      <Container className="flex flex-col gap-12 py-16 sm:py-24">
        <SectionHeading
          id="pricing-title"
          eyebrow="Pricing"
          title="One fee. Nothing hidden."
          description="Influencers never pay to join. Advertisers pay the campaign amount plus a flat 20% platform fee, charged once, before publishing."
        />

        <ul className="grid items-stretch gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <li
              key={plan.name}
              className={cn(
                "relative flex flex-col gap-6 rounded-card bg-surface p-7 sm:p-8",
                plan.highlighted
                  ? "border-[1.5px] border-primary shadow-[0_24px_60px_-24px_rgba(10,95,107,0.3)]"
                  : "border border-line",
              )}
            >
              {plan.badge ? (
                <span className="absolute -top-3 left-8 rounded-full bg-primary-strong px-3 py-[5px] text-[11.5px] font-semibold tracking-[0.04em] text-white uppercase">
                  {plan.badge}
                </span>
              ) : null}
              <div className="flex flex-col gap-2">
                <h3 className="text-[15px] font-[650]">{plan.name}</h3>
                <p className="flex items-baseline gap-1.5">
                  <span className="tabular text-4xl font-bold tracking-[-0.03em]">{plan.price}</span>
                  {plan.unit ? <span className="text-sm text-ink-secondary">{plan.unit}</span> : null}
                </p>
                <p className="text-[13.5px] leading-normal text-ink-secondary">{plan.summary}</p>
              </div>
              <ul className="flex flex-col gap-2.5 text-sm text-ink-secondary">
                {plan.points.map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <Check aria-hidden className="mt-0.5 size-4 flex-none text-success" strokeWidth={3} />
                    {point}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                variant={plan.highlighted ? "primary" : "secondary"}
                className="mt-auto w-full"
              >
                <Link href="/signup">{plan.cta}</Link>
              </Button>
            </li>
          ))}
        </ul>

        <p className="flex items-start gap-3 text-[13.5px] text-ink-secondary">
          <span aria-hidden className="mt-[7px] size-1.5 flex-none rounded-full bg-ink-muted" />
          All balances, budgets and payouts are in USD, wherever you are. The platform fee is
          debited from your wallet once, at publishing.
        </p>
      </Container>
    </section>
  );
}
