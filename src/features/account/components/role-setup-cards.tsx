import { Megaphone, Sparkles, type LucideIcon } from "lucide-react";

import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils/cn";

import { chooseInitialWorkspace } from "../actions";
import { WORKSPACE_COPY, WORKSPACES, type Workspace } from "../workspace";

const ICONS: Record<Workspace, { icon: LucideIcon; className: string }> = {
  advertiser: { icon: Megaphone, className: "bg-primary-100 text-primary" },
  influencer: { icon: Sparkles, className: "bg-surface-muted text-ink-secondary" },
};

/**
 * Two cards, each with its own submit button. Works without JavaScript; the server
 * action validates the submitted workspace value.
 */
export function RoleSetupCards({ current }: { current: Workspace }) {
  return (
    <form action={chooseInitialWorkspace} className="grid w-full max-w-[840px] gap-4 sm:gap-6 md:grid-cols-2">
      {WORKSPACES.map((workspace) => {
        const copy = WORKSPACE_COPY[workspace];
        const { icon: Icon, className: iconClass } = ICONS[workspace];
        const isPrimary = workspace === current;
        return (
          <div
            key={workspace}
            className={cn(
              "flex flex-col gap-3.5 rounded-card bg-surface p-5 transition-shadow sm:p-8",
              isPrimary
                ? "border-[1.5px] border-primary shadow-selected"
                : "border border-line shadow-xs hover:border-primary-200 focus-within:border-primary-200",
            )}
          >
            <span className={cn("flex size-11 items-center justify-center rounded-control", iconClass)}>
              <Icon aria-hidden className="size-5" strokeWidth={2.25} />
            </span>
            <h2 className="text-[17px] font-[650] tracking-[-0.02em] sm:text-[19px]">{copy.setupTitle}</h2>
            <p className="text-sm leading-relaxed text-ink-secondary sm:text-[14.5px]">
              {copy.setupDescription}
            </p>
            <ul className="mt-1 hidden flex-col gap-2 border-t border-line pt-4 sm:flex">
              {copy.setupPoints.map((point) => (
                <li key={point} className="text-[13.5px] text-ink-secondary">
                  {point}
                </li>
              ))}
            </ul>
            <SubmitButton
              name="workspace"
              value={workspace}
              variant={isPrimary ? "primary" : "secondary"}
              className="mt-2 h-12 w-full sm:mt-3 sm:h-[46px]"
            >
              {copy.setupCta}
            </SubmitButton>
          </div>
        );
      })}
    </form>
  );
}
