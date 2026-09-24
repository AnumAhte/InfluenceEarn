import {
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  FileText,
  HandCoins,
  LayoutDashboard,
  Link2,
  ListChecks,
  Megaphone,
  Receipt,
  Search,
  Settings,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Workspace } from "@/features/account/workspace";

/**
 * `href: null` marks a section that is planned but not built yet. It renders as a
 * non-interactive "Soon" item instead of a link to a missing page.
 */
export type NavItem = { label: string; href: string | null; icon: LucideIcon };
export type NavGroup = readonly NavItem[];

export type ShellArea = Workspace | "admin";

export const NAVIGATION: Record<ShellArea, readonly NavGroup[]> = {
  advertiser: [
    [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Campaigns", href: null, icon: Megaphone },
      { label: "Applicants", href: null, icon: Users },
      { label: "Tasks & reviews", href: null, icon: ClipboardCheck },
      { label: "Wallet", href: null, icon: Wallet },
      { label: "Notifications", href: null, icon: Bell },
    ],
    [{ label: "My profile", href: "/settings/profile", icon: UserRound }],
  ],
  influencer: [
    [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Find campaigns", href: null, icon: Search },
      { label: "My applications", href: null, icon: FileText },
      { label: "Active tasks", href: null, icon: ListChecks },
      { label: "Completed tasks", href: null, icon: ClipboardCheck },
      { label: "Wallet", href: null, icon: Wallet },
    ],
    [
      { label: "Social accounts", href: null, icon: Link2 },
      { label: "My profile", href: "/settings/profile", icon: UserRound },
    ],
  ],
  admin: [
    [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Users", href: null, icon: Users },
      { label: "Campaigns", href: null, icon: BriefcaseBusiness },
      { label: "Task reviews", href: null, icon: ClipboardCheck },
      { label: "Payouts", href: null, icon: HandCoins },
      { label: "Transactions", href: null, icon: Receipt },
    ],
    [
      { label: "Notifications", href: null, icon: Bell },
      { label: "Settings", href: null, icon: Settings },
    ],
  ],
};

export function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
