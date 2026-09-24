"use client";

import { ChevronDown, LogOut, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/features/auth/actions";

type UserMenuProps = {
  name: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  area: "workspace" | "admin";
};

const ITEM =
  "flex cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5 text-sm text-ink outline-none data-[disabled]:opacity-60 data-[highlighted]:bg-surface-muted";

export function UserMenu({ name, email, initials, avatarUrl, isAdmin, area }: UserMenuProps) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Account menu"
        className="flex cursor-pointer items-center gap-2.5 rounded-control border border-line py-1 pr-2.5 pl-1 transition-colors hover:bg-canvas data-[state=open]:bg-canvas"
      >
        <Avatar name={name} initials={initials} src={avatarUrl} size={30} />
        <span className="hidden max-w-[160px] flex-col items-start leading-[1.2] md:flex">
          <span className="w-full truncate text-left text-[13px] font-semibold">{name || "Your account"}</span>
          <span className="w-full truncate text-left text-[11.5px] text-ink-muted">{email}</span>
        </span>
        <ChevronDown aria-hidden className="size-3.5 text-ink-muted" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[240px] rounded-card border border-line bg-surface p-2 shadow-popover"
        >
          <div className="px-3 pt-2 pb-2.5 md:hidden">
            <p className="truncate text-sm font-semibold">{name || "Your account"}</p>
            <p className="truncate text-xs text-ink-muted">{email}</p>
          </div>
          <MenuLink href="/settings/profile" icon={UserRound} label="My profile" />
          {isAdmin ? (
            area === "admin" ? (
              <MenuLink href="/dashboard" icon={ShieldCheck} label="Back to my workspace" />
            ) : (
              <MenuLink href="/admin" icon={ShieldCheck} label="Agency admin" />
            )
          ) : null}
          <DropdownMenu.Separator className="mx-1 my-1.5 h-px bg-line" />
          <DropdownMenu.Item
            disabled={pending}
            onSelect={() => startTransition(() => signOut())}
            className={ITEM}
          >
            <LogOut aria-hidden className="size-4 text-ink-muted" />
            {pending ? "Signing out…" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <DropdownMenu.Item asChild className={ITEM}>
      <Link href={href}>
        <Icon aria-hidden className="size-4 text-ink-muted" />
        {label}
      </Link>
    </DropdownMenu.Item>
  );
}
