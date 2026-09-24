import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control border font-[550] transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "border-primary-strong bg-primary-strong text-white shadow-primary-sm hover:border-primary-hover hover:bg-primary-hover",
        secondary: "border-line bg-surface text-ink hover:bg-canvas",
        ghost: "border-transparent bg-transparent text-ink-secondary hover:bg-surface-muted",
        danger: "border-danger bg-danger text-white hover:border-danger-fg hover:bg-danger-fg",
        /** Outline button on dark (night) surfaces. */
        inverse: "border-white/20 bg-transparent text-white hover:bg-white/10",
      },
      size: {
        sm: "h-[38px] px-3.5 text-sm",
        md: "h-11 px-[18px] text-[14.5px]",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-[38px] p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a Link) with button styles. */
    asChild?: boolean;
    /** Shows a spinner and blocks interaction while an action runs. */
    pending?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  pending = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
}
