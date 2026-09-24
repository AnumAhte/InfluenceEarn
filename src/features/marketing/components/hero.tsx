import Link from "next/link";

import { Button } from "@/components/ui/button";

import { ProductPreview } from "./product-preview";
import { Container } from "./section";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-night">
      <Container className="flex flex-col items-center gap-6 pt-16 text-center sm:pt-24">
        <p className="inline-flex h-[30px] items-center gap-2 rounded-full border border-white/14 bg-white/6 px-3 text-[12.5px] font-medium text-primary-200">
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          Campaigns are funded before they go live
        </p>
        <h1
          id="hero-title"
          className="max-w-[880px] text-[40px] leading-[1.05] font-bold tracking-[-0.04em] text-balance text-white sm:text-[52px] lg:text-[64px]"
        >
          Influencer campaigns built around real work.
        </h1>
        <p className="max-w-[640px] text-base leading-relaxed text-pretty text-ink-disabled sm:text-lg">
          Create campaigns, connect with the right creators, review completed work, and manage
          payments through one simple platform.
        </p>
        <div className="mt-2 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Button asChild size="lg" className="shadow-primary">
            <Link href="/signup">Start a campaign</Link>
          </Button>
          <Button asChild size="lg" variant="inverse">
            <Link href="/signup">Find campaigns</Link>
          </Button>
        </div>
        <p className="-mt-1 text-[13px] text-ink-subtle">
          One account. Switch between Advertiser and Influencer anytime.
        </p>

        <ProductPreview />
      </Container>

      <Container className="flex flex-col items-center justify-center gap-3 pt-12 pb-16 text-center sm:flex-row sm:gap-10 sm:pb-24">
        <span className="text-[15px] font-[550] tracking-[-0.01em] text-white">
          Built for brands, agencies, and creators worldwide.
        </span>
        <span aria-hidden className="hidden h-[18px] w-px bg-white/18 sm:block" />
        <span className="text-[15px] text-ink-subtle">
          Simple campaign management. Clear requirements. Human review.
        </span>
      </Container>
    </section>
  );
}
