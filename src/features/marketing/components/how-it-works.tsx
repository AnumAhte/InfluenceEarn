"use client";

import { Tabs } from "radix-ui";

import { cn } from "@/lib/utils/cn";

import { Container, SectionHeading } from "./section";

const STEPS = {
  advertiser: [
    { title: "Create a campaign", body: "Set your campaign type, platforms, influencer requirements, budget and instructions." },
    { title: "Fund & publish", body: "The campaign amount and 20% platform fee are debited from your wallet. It goes live once the debit clears." },
    { title: "Select & review", body: "Influencers apply, you select creators manually, and review completed work." },
    { title: "Approve & pay", body: "You approve completion and the agency releases the influencer payment." },
  ],
  influencer: [
    { title: "Switch to Influencer", body: "Create one account and switch roles. No social accounts are needed to sign up." },
    { title: "Connect the required account", body: "A campaign lists the platform it needs. Link that account to unlock the apply button." },
    { title: "Complete the task", body: "Publish the deliverable, mark the task complete and submit the social link when required." },
    { title: "Get paid", body: "The advertiser checks your link and approves. The agency then releases your payment." },
  ],
} as const;

const TAB_TRIGGER =
  "cursor-pointer rounded-full px-4 py-2 text-[13px] font-[550] text-ink-secondary transition-colors data-[state=active]:bg-night data-[state=active]:text-white";

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-16 border-t border-line bg-surface">
      <Container className="py-16 sm:py-24">
        <Tabs.Root defaultValue="advertiser" className="flex flex-col gap-12">
          <div className="flex flex-wrap items-end justify-between gap-6 lg:gap-10">
            <SectionHeading id="how-title" eyebrow="How it works" title="Four steps, from brief to wallet." />
            <Tabs.List aria-label="Show steps for" className="flex gap-2 rounded-full bg-surface-muted p-1">
              <Tabs.Trigger value="advertiser" className={TAB_TRIGGER}>
                Advertiser
              </Tabs.Trigger>
              <Tabs.Trigger value="influencer" className={TAB_TRIGGER}>
                Influencer
              </Tabs.Trigger>
            </Tabs.List>
          </div>

          {(Object.keys(STEPS) as (keyof typeof STEPS)[]).map((role) => (
            <Tabs.Content key={role} value={role} className="focus-visible:outline-offset-8">
              <ol className="grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
                {STEPS[role].map((step, index) => (
                  <li
                    key={step.title}
                    className={cn(
                      "flex flex-col gap-3 border-t-2 pt-6",
                      index === 0 ? "border-primary" : "border-line",
                    )}
                  >
                    <span
                      className={cn(
                        "tabular text-[12.5px] font-semibold",
                        index === 0 ? "text-primary-strong" : "text-ink-muted",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-[17px] font-[650] tracking-[-0.015em]">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-ink-secondary">{step.body}</p>
                  </li>
                ))}
              </ol>
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </Container>
    </section>
  );
}
