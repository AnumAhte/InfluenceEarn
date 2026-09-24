import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Right-aligned content on the label row, e.g. "Forgot password?". */
  labelAside?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Label + control + hint/error with correctly wired ids. Pair with `fieldProps()`. */
export function Field({ id, label, error, hint, labelAside, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-[7px]", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-[550] text-ink">
          {label}
        </label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] font-medium text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12.5px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Accessibility attributes for a control rendered inside `<Field>`. */
export function fieldProps(id: string, error?: string, hasHint = false) {
  const describedBy = error ? `${id}-error` : hasHint ? `${id}-hint` : undefined;
  return {
    id,
    name: id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  } as const;
}
