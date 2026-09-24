import { Plus } from "lucide-react";
import Link from "next/link";

import { Container, Eyebrow } from "./section";

const FAQS = [
  {
    question: "When exactly do I pay?",
    answer:
      "Before your campaign is published. The campaign amount plus the 20% platform fee is debited from your wallet in one step, and the campaign only becomes visible to influencers once that funding succeeds.",
  },
  {
    question: "How do influencers get paid?",
    answer:
      "The influencer marks the task complete and submits the social link. The advertiser opens the link, checks the work and approves it. The agency is then notified, reviews the payout status and releases the payment.",
  },
  {
    question: "Can I be an advertiser and an influencer?",
    answer:
      "Yes. One account carries both roles and you switch between them inside the app. No second signup, and no social accounts are required to create the account.",
  },
  {
    question: "Who can apply to my campaign?",
    answer:
      "Only influencers who meet the requirements you set. If the campaign requires Instagram, an influencer must have a linked Instagram account before they can apply. You can also set minimum followers, gender, age, creator category and your own conditions. You review every applicant yourself.",
  },
  {
    question: "What if the work is not what I asked for?",
    answer:
      "Open the submitted link, review it and choose Reject instead of Approve Completion, with a reason. Nothing is released to that influencer for the rejected submission.",
  },
] as const;

export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="border-t border-line bg-surface">
      <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[380px_1fr] lg:gap-16">
        <div className="flex flex-col gap-3">
          <Eyebrow>FAQ</Eyebrow>
          <h2 id="faq-title" className="text-[28px] leading-[1.15] font-bold tracking-[-0.03em] sm:text-4xl">
            Questions we get
            <br />
            before the first campaign.
          </h2>
          <p className="text-[15px] leading-relaxed text-ink-secondary">
            Ready to try it?{" "}
            <Link href="/signup" className="font-[550] text-primary-strong hover:text-primary-hover">
              Create a free account
            </Link>
            .
          </p>
        </div>

        <div className="border-b border-line">
          {FAQS.map((faq, index) => (
            <details key={faq.question} open={index === 0} className="group border-t border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-base font-semibold tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                {faq.question}
                <Plus
                  aria-hidden
                  className="size-[18px] flex-none text-ink-muted transition-transform group-open:rotate-45"
                />
              </summary>
              <p className="-mt-2 max-w-[640px] pb-6 text-[14.5px] leading-[1.65] text-ink-secondary">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
