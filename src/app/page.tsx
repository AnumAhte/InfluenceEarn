import { Faq } from "@/features/marketing/components/faq";
import { Features } from "@/features/marketing/components/features";
import { ForInfluencers } from "@/features/marketing/components/for-influencers";
import { Hero } from "@/features/marketing/components/hero";
import { HowItWorks } from "@/features/marketing/components/how-it-works";
import { MarketplacePreview } from "@/features/marketing/components/marketplace-preview";
import { PaymentFlow } from "@/features/marketing/components/payment-flow";
import { Pricing } from "@/features/marketing/components/pricing";
import { SiteHeader } from "@/features/marketing/components/site-header";
import { ClosingCta, SiteFooter } from "@/features/marketing/components/site-footer";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-popover"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <PaymentFlow />
        <Features />
        <HowItWorks />
        <MarketplacePreview />
        <ForInfluencers />
        <Pricing />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
