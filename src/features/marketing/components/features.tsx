import {
  BadgeCheck,
  HandCoins,
  Link2,
  Repeat2,
  SlidersHorizontal,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

import { Container, SectionHeading } from "./section";

type Feature = { title: string; body: string; icon: LucideIcon; iconClass: string };

const FEATURES: Feature[] = [
  {
    title: "Funded from your wallet",
    body: "The advertiser pays the campaign amount plus the 20% platform fee. The campaign only becomes visible to influencers after funding succeeds.",
    icon: Wallet,
    iconClass: "bg-primary-100 text-primary",
  },
  {
    title: "Required social account",
    body: "A campaign names the platform it needs. If it requires Instagram, only influencers with a linked Instagram account can apply.",
    icon: Link2,
    iconClass: "bg-surface-muted text-ink-secondary",
  },
  {
    title: "Manual advertiser approval",
    body: "The influencer marks the task complete and submits the social link. The advertiser opens it, checks the work, then approves or rejects.",
    icon: BadgeCheck,
    iconClass: "bg-success-bg text-success",
  },
  {
    title: "Flexible campaign requirements",
    body: "Optionally set platform, minimum followers, number of influencers, payment per influencer, gender, age, creator category and your own instructions.",
    icon: SlidersHorizontal,
    iconClass: "bg-warning-bg text-warning",
  },
  {
    title: "Agency-managed payouts",
    body: "After the advertiser approves, the agency is notified, reviews the payout status and releases the payment to the influencer.",
    icon: HandCoins,
    iconClass: "bg-surface-muted text-ink-secondary",
  },
];

export function Features() {
  return (
    <section aria-labelledby="features-title" className="border-t border-line bg-canvas">
      <Container className="flex flex-col gap-12 py-16 sm:py-24">
        <SectionHeading
          id="features-title"
          eyebrow="Why InfluencEarn"
          title="Everything a campaign actually needs."
          description="Six things the platform is built around. No automated scoring, no guesswork."
        />
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-6 shadow-xs sm:p-7"
            >
              <FeatureIcon icon={feature.icon} className={feature.iconClass} />
              <h3 className="text-[16.5px] font-[650] tracking-[-0.01em]">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-ink-secondary">{feature.body}</p>
            </li>
          ))}
          <li className="flex flex-col gap-2.5 rounded-card bg-night p-6 sm:p-7">
            <FeatureIcon icon={Repeat2} className="bg-white/6 text-primary-300" />
            <h3 className="text-[16.5px] font-[650] tracking-[-0.01em] text-white">
              One account, two roles
            </h3>
            <p className="text-sm leading-relaxed text-ink-disabled">
              Sign up once, no social accounts needed. Switch between Advertiser and Influencer
              whenever you need to, without a second login.
            </p>
          </li>
        </ul>
      </Container>
    </section>
  );
}

function FeatureIcon({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span className={cn("mb-2 flex size-10 items-center justify-center rounded-control", className)}>
      <Icon aria-hidden className="size-[18px]" strokeWidth={2.25} />
    </span>
  );
}
