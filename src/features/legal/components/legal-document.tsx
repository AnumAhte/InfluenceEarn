import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

import { LEGAL_DOCUMENTS_APPROVED } from "../status";

export { LEGAL_DOCUMENTS_APPROVED };

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="InfluencEarn home" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <Logo size="sm" />
          </Link>
          <nav aria-label="Legal" className="flex gap-4 text-[13.5px] font-[550]">
            <Link href="/terms" className="text-ink-secondary hover:text-ink">Terms</Link>
            <Link href="/privacy" className="text-ink-secondary hover:text-ink">Privacy</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        {!LEGAL_DOCUMENTS_APPROVED ? (
          <div role="note" className="rounded-xl border border-warning-bg bg-warning-bg/60 px-4 py-3.5 text-[13.5px] leading-relaxed text-warning-fg">
            <strong className="font-[650]">Draft — requires client and legal approval.</strong> This document has not been
            reviewed or approved and is not in effect. Highlighted items must be confirmed before launch.
          </div>
        ) : null}
        <article className="legal flex flex-col gap-5 rounded-panel border border-line bg-surface px-5 py-7 text-[14.5px] leading-relaxed text-ink-secondary sm:px-9 sm:py-10">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-ink sm:text-[28px]">{title}</h1>
          {children}
        </article>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="pt-2 text-[17px] font-[650] tracking-[-0.01em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
}

/** A fact only the client or their lawyer can supply. Visibly marked so it can't ship unnoticed. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-warning-bg px-1 py-px font-[550] text-warning-fg">
      [To confirm: {children}]
    </mark>
  );
}
