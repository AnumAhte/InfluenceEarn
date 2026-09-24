import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils/cn";

export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full rounded-panel border border-line bg-surface shadow-panel",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold tracking-[-0.025em] sm:text-[28px]">{title}</h1>
      {description ? (
        <p className="text-[15px] leading-relaxed text-ink-secondary">{description}</p>
      ) : null}
    </div>
  );
}

export function AuthLogoLink({ theme = "light" }: { theme?: "light" | "dark" }) {
  return (
    <Link href="/" aria-label="InfluencEarn home" className="w-fit rounded-lg">
      <Logo theme={theme} />
    </Link>
  );
}

export function AuthFooterLink({ prompt, href, label }: { prompt: string; href: string; label: string }) {
  return (
    <p className="text-center text-sm text-ink-secondary">
      {prompt}{" "}
      <Link href={href} className="font-[550] text-primary-strong hover:text-primary-hover">
        {label}
      </Link>
    </p>
  );
}

/** Success confirmation shown after sign-up or a reset request. */
export function CheckEmailNotice({
  title,
  body,
  email,
  children,
}: {
  title: string;
  body: string;
  email?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-5" role="status">
      <span className="flex size-12 items-center justify-center rounded-[14px] bg-success-bg text-success-fg">
        <Check aria-hidden className="size-5" strokeWidth={3} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-bold tracking-[-0.025em]">{title}</h1>
        <p className="text-[15px] leading-relaxed text-ink-secondary">{body}</p>
      </div>
      {email ? (
        <p className="flex w-full items-center gap-2.5 rounded-control bg-surface-muted px-3.5 py-3 text-[13.5px] text-ink-secondary">
          <span aria-hidden className="size-1.5 flex-none rounded-full bg-ink-secondary" />
          Sent to <span className="font-[550] break-all text-ink">{email}</span>
        </p>
      ) : null}
      {children}
    </div>
  );
}
