import { dollars, formatMoney } from "@/domain/money";
import { calculateCampaignFunding } from "@/domain/pricing";

import { Container, Eyebrow } from "./section";

// Worked example shown across the landing page: 100 influencers × $10.
export const WORKED_EXAMPLE = {
  creators: 100,
  paymentPerCreator: dollars(10),
} as const;

export function PaymentFlow() {
  const { creators, paymentPerCreator } = WORKED_EXAMPLE;
  const funding = calculateCampaignFunding(paymentPerCreator, creators);
  const money = (value: typeof paymentPerCreator) => formatMoney(value, { showCents: false });

  const steps = [
    {
      label: "Campaign amount",
      labelClass: "text-success-fg",
      value: money(funding.creatorBudget),
      body: `${creators} influencers × ${money(paymentPerCreator)} per influencer, set by the advertiser.`,
    },
    {
      label: "Platform fee",
      labelClass: "text-primary-strong",
      value: money(funding.platformFee),
      body: "A flat 20% on the campaign amount. No other charges.",
    },
    {
      label: "Advertiser pays",
      labelClass: "text-warning-fg",
      value: money(funding.totalFunding),
      body: "Debited from the wallet before publishing. The campaign goes live once funding succeeds.",
    },
    {
      label: "Paid to influencer",
      labelClass: "text-success-fg",
      value: money(paymentPerCreator),
      body: "Released by the agency after the advertiser approves the work.",
    },
  ];

  return (
    <section aria-labelledby="payment-flow-title" className="bg-surface">
      <Container className="flex flex-col gap-10 py-16 sm:py-[72px]">
        <div className="flex flex-wrap items-end justify-between gap-6 lg:gap-10">
          <div className="flex max-w-[520px] flex-col gap-2.5">
            <Eyebrow>Payment flow</Eyebrow>
            <h2
              id="payment-flow-title"
              className="text-[28px] leading-[1.15] font-bold tracking-[-0.03em] sm:text-[34px]"
            >
              Funded from your wallet. Released after approval.
            </h2>
          </div>
          <p className="max-w-[400px] text-sm leading-relaxed text-pretty text-ink-muted">
            A worked example: {creators} influencers at {money(paymentPerCreator)} each, plus the
            20% platform fee.
          </p>
        </div>

        <dl className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.label} className="flex flex-col gap-2 bg-surface px-6 py-[26px]">
              <dt className={`text-[11.5px] font-semibold tracking-[0.06em] uppercase ${step.labelClass}`}>
                {step.label}
              </dt>
              <dd className="tabular text-[26px] font-bold tracking-[-0.03em] text-ink">{step.value}</dd>
              <dd className="text-[13.5px] leading-relaxed text-ink-secondary">{step.body}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
