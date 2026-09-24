"use client";

import { Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";

import type { ShellArea } from "../navigation";
import { SidebarNav } from "./sidebar-nav";

/** Slide-over navigation for small screens. Radix handles focus trap and Escape. */
export function MobileNav({ area }: { area: ShellArea }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open navigation"
        className="flex size-10 cursor-pointer items-center justify-center rounded-control border border-line bg-surface text-ink-secondary hover:bg-canvas lg:hidden"
      >
        <Menu aria-hidden className="size-[18px]" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-night/50 backdrop-blur-[2px] lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col gap-6 overflow-y-auto bg-night px-3.5 py-5 shadow-popover lg:hidden">
          <div className="flex items-center justify-between px-2">
            <Logo theme="dark" size="sm" />
            <Dialog.Close
              aria-label="Close navigation"
              className="flex size-9 cursor-pointer items-center justify-center rounded-control text-ink-disabled hover:bg-white/10 hover:text-white"
            >
              <X aria-hidden className="size-[18px]" />
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">Move between sections of the app.</Dialog.Description>
          <SidebarNav area={area} onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
