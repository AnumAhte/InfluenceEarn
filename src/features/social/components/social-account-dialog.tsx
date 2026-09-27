"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useActionState, useEffect, useState, type ReactNode } from "react";

import { Callout } from "@/components/ui/callout";
import { Field, fieldProps } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { PLATFORM_META, type SocialPlatform } from "@/domain/campaigns/catalog";
import { handleHint } from "@/domain/creators/social";
import { IDLE, type ActionState } from "@/lib/forms/action-state";

import { connectSocialAccount, updateSocialAccount, type SocialField } from "../actions";

type Existing = { id: string; handle: string; followerCount: number | null };

/**
 * Manual linking: handle + self-reported follower count. No OAuth is simulated —
 * the copy says plainly that numbers are self-reported and checked by advertisers.
 */
export function SocialAccountDialog({
  platform,
  existing,
  trigger,
}: {
  platform: SocialPlatform;
  existing?: Existing;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const label = PLATFORM_META[platform].label;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-night/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-5 overflow-y-auto rounded-t-panel border border-line bg-surface p-6 shadow-popover sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100vw-32px)] sm:max-w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <Dialog.Title className="text-xl font-bold tracking-[-0.02em]">
                {existing ? `Update ${label}` : `Connect ${label}`}
              </Dialog.Title>
              <Dialog.Description className="text-sm leading-relaxed text-ink-secondary">
                Add your {label} handle and follower count. Advertisers open your profile to check them before selecting you.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-control text-ink-muted hover:bg-surface-muted">
              <X aria-hidden className="size-4" />
            </Dialog.Close>
          </div>
          {open ? <AccountForm platform={platform} existing={existing} onDone={() => setOpen(false)} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AccountForm({ platform, existing, onDone }: { platform: SocialPlatform; existing?: Existing; onDone: () => void }) {
  const [state, action] = useActionState<ActionState<SocialField>, FormData>(
    existing ? updateSocialAccount : connectSocialAccount,
    IDLE,
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="platform" value={platform} />
      {existing ? <input type="hidden" name="accountId" value={existing.id} /> : null}
      {state.status === "error" && !state.fieldErrors ? <Callout tone="danger">{state.message}</Callout> : null}

      <Field id="handle" label="Handle or profile link" error={errors.handle} hint={handleHint(platform)}>
        <Input
          {...fieldProps("handle", errors.handle, true)}
          defaultValue={values.handle ?? existing?.handle ?? ""}
          placeholder={platform === "facebook" ? "yourpage" : "@yourhandle"}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>
      <Field id="followerCount" label="Followers" error={errors.followerCount} hint="The number shown on your profile today.">
        <Input
          {...fieldProps("followerCount", errors.followerCount, true)}
          inputMode="numeric"
          defaultValue={values.followerCount ?? (existing?.followerCount != null ? String(existing.followerCount) : "")}
          placeholder="e.g. 12500"
          autoComplete="off"
          className="tabular"
          required
        />
      </Field>

      <Callout tone="neutral">
        Self-reported. InfluencEarn doesn&apos;t verify follower counts automatically — advertisers review your live profile.
      </Callout>

      <SubmitButton size="lg" pendingLabel="Saving…" className="w-full">
        {existing ? "Save changes" : `Connect ${PLATFORM_META[platform].label}`}
      </SubmitButton>
    </form>
  );
}
