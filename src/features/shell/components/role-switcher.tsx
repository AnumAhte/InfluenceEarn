"use client";

import { Check, ChevronDown, Megaphone, Sparkles } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { switchWorkspace } from "@/features/account/actions";
import { WORKSPACE_COPY, WORKSPACES, type Workspace } from "@/features/account/workspace";
import { cn } from "@/lib/utils/cn";

const ICONS = {
  advertiser: { icon: Megaphone, className: "bg-primary-100 text-primary" },
  influencer: { icon: Sparkles, className: "bg-surface-muted text-ink-secondary" },
} as const;

/**
 * Header control for moving between the Advertiser and Influencer workspaces.
 * The server action re-validates the value; the client only chooses which to request.
 */
export function RoleSwitcher({ current }: { current: Workspace }) {
  const [pending, startTransition] = useTransition();

  function select(workspace: Workspace) {
    if (workspace === current) return;
    const formData = new FormData();
    formData.set("workspace", workspace);
    startTransition(() => switchWorkspace(formData));
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Current role: ${WORKSPACE_COPY[current].label}. Switch role`}
        className="group flex h-10 cursor-pointer items-center gap-2.5 rounded-control border border-line bg-surface pr-3 pl-2.5 transition-colors hover:bg-canvas data-[state=open]:border-primary data-[state=open]:bg-canvas"
      >
        <span className="flex size-6 items-center justify-center rounded-[7px] bg-night text-[11px] font-bold text-white">
          {pending ? <Spinner className="size-3" /> : WORKSPACE_COPY[current].label[0]}
        </span>
        <span className="flex flex-col items-start leading-[1.15]">
          <span className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted uppercase">
            Current role
          </span>
          <span className="text-[13.5px] font-semibold text-ink">{WORKSPACE_COPY[current].label}</span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-3.5 text-ink-muted transition-transform group-data-[state=open]:rotate-180"
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 w-[288px] rounded-card border border-line bg-surface p-2 shadow-popover"
        >
          <DropdownMenu.Label className="px-3 pt-2.5 pb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Switch role
          </DropdownMenu.Label>
          {WORKSPACES.map((workspace) => {
            const { icon: Icon, className } = ICONS[workspace];
            const isCurrent = workspace === current;
            return (
              <DropdownMenu.Item
                key={workspace}
                disabled={pending}
                onSelect={() => select(workspace)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 outline-none data-[disabled]:opacity-60 data-[highlighted]:bg-surface-muted",
                  isCurrent && "bg-canvas",
                )}
              >
                <span className={cn("flex size-8 flex-none items-center justify-center rounded-[9px]", className)}>
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{WORKSPACE_COPY[workspace].switchLabel}</span>
                  <span className="text-[12.5px] text-ink-muted">{WORKSPACE_COPY[workspace].switchHint}</span>
                </span>
                {isCurrent ? (
                  <Check aria-label="Current role" className="ml-auto size-4 text-primary" strokeWidth={3} />
                ) : null}
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator className="mx-1 mt-2 h-px bg-line" />
          <p className="px-2 pt-2.5 pb-1.5 text-[12.5px] leading-normal text-ink-muted">
            Same account and login. Campaigns and applications stay separate.
          </p>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
