"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

import { isActivePath, NAVIGATION, type ShellArea } from "../navigation";

const ITEM = "flex items-center gap-2.5 rounded-nav px-3 py-2.5 text-sm";

export function SidebarNav({ area, onNavigate }: { area: ShellArea; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = NAVIGATION[area];

  return (
    <nav aria-label={area === "admin" ? "Admin" : "Workspace"} className="flex flex-col gap-[3px]">
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col gap-[3px]">
          {groupIndex > 0 ? <div aria-hidden className="mx-2 my-3 h-px bg-white/10" /> : null}
          <ul className="flex flex-col gap-[3px]">
            {group.map((item) => {
              const Icon = item.icon;
              if (!item.href) {
                return (
                  <li key={item.label}>
                    <span aria-disabled="true" className={cn(ITEM, "cursor-default text-ink-subtle")}>
                      <Icon aria-hidden className="size-4 flex-none" />
                      {item.label}
                      <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.04em] text-ink-subtle uppercase">
                        Soon
                      </span>
                    </span>
                  </li>
                );
              }
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      ITEM,
                      "transition-colors focus-visible:outline-primary-300",
                      active
                        ? "bg-white/10 font-semibold text-white"
                        : "text-ink-disabled hover:bg-white/6 hover:text-white",
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn("size-4 flex-none", active ? "text-primary-300" : "text-ink-subtle")}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
