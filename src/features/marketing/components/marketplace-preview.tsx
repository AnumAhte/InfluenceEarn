import { Chip } from "@/components/ui/status-badge";

import { Container, ExampleTag, SectionHeading } from "./section";

// Illustrative campaign cards. Not real campaigns; tagged "Example" in the UI.
const EXAMPLE_CAMPAIGNS = [
  {
    title: "Winter knit drop — try-on reels",
    meta: "London · Fashion & lifestyle",
    chips: ["Instagram Reel", "Female, 18–30", "25k+ followers"],
    payment: "$350",
    closes: "Closes in 4 days",
    slots: "6 of 10 places left",
  },
  {
    title: "Pantry staples bundle unboxing",
    meta: "New York · Food & home",
    chips: ["TikTok video", "Food category", "50k+ followers"],
    payment: "$600",
    closes: "Closes in 9 days",
    slots: "3 of 6 places left",
  },
  {
    title: "Campus fintech app walkthrough",
    meta: "Berlin · Tech & finance",
    chips: ["YouTube Short", "Age 18–25", "10k+ followers"],
    payment: "$180",
    closes: "Closes in 2 days",
    slots: "2 of 12 places left",
  },
] as const;

export function MarketplacePreview() {
  return (
    <section
      id="marketplace"
      aria-labelledby="marketplace-title"
      className="scroll-mt-16 border-t border-line bg-canvas"
    >
      <Container className="flex flex-col gap-12 py-16 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6 lg:gap-10">
          <SectionHeading
            id="marketplace-title"
            eyebrow="Marketplace"
            title="Live campaigns, requirements upfront."
          />
          <p className="max-w-[360px] text-sm leading-relaxed text-pretty text-ink-secondary">
            Examples of what influencers see once a campaign is funded. Payment per influencer is
            set by the advertiser.
          </p>
        </div>

        <ul className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {EXAMPLE_CAMPAIGNS.map((campaign) => (
            <li
              key={campaign.title}
              className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-xs"
            >
              <div className="flex items-center justify-between gap-3">
                <ExampleTag />
                <span className="text-[12.5px] text-ink-muted">{campaign.closes}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[17px] font-[650] tracking-[-0.015em]">{campaign.title}</h3>
                <p className="text-[13.5px] text-ink-secondary">{campaign.meta}</p>
              </div>
              <ul aria-label="Requirements" className="flex flex-wrap gap-1.5">
                {campaign.chips.map((chip) => (
                  <li key={chip}>
                    <Chip>{chip}</Chip>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-end justify-between gap-4 border-t border-line-soft pt-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11.5px] text-ink-secondary">Payment per influencer</span>
                  <span className="tabular text-xl font-bold tracking-[-0.02em]">{campaign.payment}</span>
                </div>
                <span className="tabular text-[12.5px] text-ink-secondary">{campaign.slots}</span>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
