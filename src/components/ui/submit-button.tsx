"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "./button";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type" | "pending" | "asChild"> & {
  pendingLabel?: string;
};

/**
 * Submit button for Server Action forms. When several buttons share a form (name/value),
 * only the one that was clicked shows the spinner.
 */
export function SubmitButton({ pendingLabel, children, name, value, disabled, ...props }: SubmitButtonProps) {
  const { pending, data } = useFormStatus();
  const isThisButton =
    pending && (name === undefined || value === undefined || data?.get(name) === String(value));

  return (
    <Button
      type="submit"
      name={name}
      value={value}
      pending={isThisButton}
      disabled={disabled || pending}
      {...props}
    >
      {isThisButton && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
