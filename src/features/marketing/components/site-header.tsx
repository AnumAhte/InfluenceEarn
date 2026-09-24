import { Menu } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

import { Container } from "./section";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#marketplace", label: "Campaigns" },
  { href: "#creators", label: "For influencers" },
  { href: "#pricing", label: "Pricing" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/92 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-5 sm:px-7">
        <Link href="/" aria-label="InfluencEarn home" className="rounded-lg">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-[22px] text-sm lg:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-ink-secondary hover:text-night">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="px-4">
            <Link href="/signup">Start a campaign</Link>
          </Button>

          {/* Mobile: native disclosure keeps the menu keyboard- and screen-reader-friendly without JS. */}
          <details className="group relative lg:hidden">
            <summary
              className="flex size-[38px] cursor-pointer list-none items-center justify-center rounded-nav border border-line bg-surface text-ink-secondary hover:bg-canvas [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu aria-hidden className="size-[18px]" />
            </summary>
            <div className="absolute top-12 right-0 w-56 rounded-card border border-line bg-surface p-2 shadow-popover">
              <nav aria-label="Main (mobile)" className="flex flex-col">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-control px-3 py-2.5 text-sm text-ink hover:bg-surface-muted"
                  >
                    {link.label}
                  </a>
                ))}
                <Link
                  href="/login"
                  className="mt-1 rounded-control border-t border-line px-3 py-2.5 text-sm font-[550] text-ink hover:bg-surface-muted"
                >
                  Sign in
                </Link>
              </nav>
            </div>
          </details>
        </div>
      </Container>
    </header>
  );
}
