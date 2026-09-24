import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

import { Container } from "./section";

const PRODUCT_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#creators", label: "For influencers" },
  { href: "#pricing", label: "Pricing" },
  { href: "#marketplace", label: "Campaigns" },
] as const;

const ACCOUNT_LINKS = [
  { href: "/signup", label: "Create an account" },
  { href: "/login", label: "Sign in" },
] as const;

export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="bg-night">
      <Container className="flex flex-wrap items-center justify-between gap-8 py-16 sm:py-[88px] lg:gap-12">
        <div className="flex max-w-[560px] flex-col gap-3">
          <h2 id="cta-title" className="text-[28px] leading-[1.15] font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Your next campaign can be live today.
          </h2>
          <p className="text-base leading-relaxed text-ink-disabled">
            Set the requirements, fund the campaign, and start receiving applications from eligible
            influencers.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">Start a campaign</Link>
          </Button>
          <Button asChild size="lg" variant="inverse">
            <Link href="/signup">Find campaigns</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/6 bg-night">
      <Container className="grid gap-10 pt-14 pb-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-12">
        <div className="flex flex-col gap-3.5">
          <Logo theme="dark" size="sm" />
          <p className="max-w-[280px] text-[13.5px] leading-relaxed text-ink-subtle">
            A global influencer marketplace. Every account carries a USD wallet, and campaigns are
            funded from it before they go live.
          </p>
        </div>
        <FooterColumn title="Product" links={PRODUCT_LINKS} />
        <FooterColumn title="Account" links={ACCOUNT_LINKS} />
      </Container>
      <Container className="flex flex-wrap items-center justify-between gap-6 border-t border-white/6 pt-6 pb-10">
        <span className="text-[12.5px] text-ink-subtle">
          © {new Date().getFullYear()} InfluencEarn. All rights reserved.
        </span>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <nav aria-label={title} className="flex flex-col gap-3">
      <span className="text-xs font-semibold tracking-[0.06em] text-ink-subtle uppercase">{title}</span>
      {links.map((link) =>
        link.href.startsWith("#") ? (
          <a key={link.href} href={link.href} className="text-[13.5px] text-line hover:text-white">
            {link.label}
          </a>
        ) : (
          <Link key={link.href} href={link.href} className="text-[13.5px] text-line hover:text-white">
            {link.label}
          </Link>
        ),
      )}
    </nav>
  );
}
