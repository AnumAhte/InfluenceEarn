import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { initialsFor } from "@/features/account/onboarding";
import type { CurrentAccount } from "@/features/account/queries";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

import type { ShellArea } from "../navigation";
import { MobileNav } from "./mobile-nav";
import { RoleSwitcher } from "./role-switcher";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

/** Authenticated layout: dark sidebar (desktop), slide-over nav (mobile) and top bar. */
export function AppShell({ account, area, children }: { account: CurrentAccount; area: ShellArea; children: ReactNode }) {
  const { profile } = account;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-popover"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto bg-night px-3.5 py-5 lg:flex">
        <Link href={area === "admin" ? "/admin" : "/dashboard"} aria-label="InfluencEarn home" className="w-fit rounded-lg px-2 pt-1">
          <Logo theme="dark" />
        </Link>
        <SidebarNav area={area} />
        <SidebarNote area={area} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-md sm:h-[68px] sm:px-7">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <MobileNav area={area} />
            {area === "admin" ? (
              <span className="flex items-center gap-2 rounded-control bg-night px-3 py-2 text-[13px] font-semibold text-white">
                <ShieldCheck aria-hidden className="size-4 text-primary-300" />
                Agency admin
              </span>
            ) : (
              <RoleSwitcher current={area} />
            )}
          </div>
          <div className="flex items-center gap-2">
          <NotificationBell userId={account.userId} />
          <UserMenu
            name={profile.full_name}
            email={account.email}
            initials={initialsFor(profile.full_name, account.email[0]?.toUpperCase() ?? "?")}
            avatarUrl={account.avatarUrl}
            isAdmin={account.isAdmin}
            area={area === "admin" ? "admin" : "workspace"}
          />
          </div>
        </header>

        <main id="main" className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarNote({ area }: { area: ShellArea }) {
  const note =
    area === "advertiser"
      ? { title: "Campaign not live?", body: "A campaign is published only after it has been funded." }
      : area === "influencer"
        ? { title: "Need a social account?", body: "Only when a campaign requires that platform. Nothing is needed to sign up." }
        : { title: "Manual payouts", body: "Payments are released only after the advertiser approves the work." };

  return (
    <div className="mt-auto flex flex-col gap-2 rounded-[14px] border border-white/10 p-3.5">
      <span className="text-[13px] font-semibold text-white">{note.title}</span>
      <span className="text-[12.5px] leading-normal text-ink-subtle">{note.body}</span>
    </div>
  );
}
