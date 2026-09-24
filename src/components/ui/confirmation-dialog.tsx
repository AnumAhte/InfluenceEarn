"use client";

import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";

/**
 * Accessible confirmation for destructive or irreversible actions (focus trap,
 * Escape to cancel, focus returns to the trigger). Either pass a `confirm` control,
 * or omit it and render your own form with `<ConfirmationDialogFooter>` inside it
 * (so submit buttons can show their pending state).
 */
export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirm,
  cancelLabel = "Keep it",
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirm?: ReactNode;
  cancelLabel?: string;
  children?: ReactNode;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-night/50 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-panel border border-line bg-surface p-6 shadow-popover sm:p-8">
          <div className="flex flex-col gap-2">
            <AlertDialog.Title className="text-xl font-bold tracking-[-0.02em]">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-[14.5px] leading-relaxed text-ink-secondary">{description}</AlertDialog.Description>
          </div>
          {children}
          {confirm ? <ConfirmationDialogFooter cancelLabel={cancelLabel}>{confirm}</ConfirmationDialogFooter> : null}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function ConfirmationDialogFooter({ cancelLabel = "Keep it", children }: { cancelLabel?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <AlertDialog.Cancel className="inline-flex h-11 cursor-pointer items-center justify-center rounded-control border border-line bg-surface px-[18px] text-[14.5px] font-[550] text-ink hover:bg-canvas">
        {cancelLabel}
      </AlertDialog.Cancel>
      {children}
    </div>
  );
}
