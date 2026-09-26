"use client";

import { X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function WizardSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-card border border-line bg-surface shadow-xs">
      <header className="flex flex-col gap-1 border-b border-line px-5 py-5 sm:px-6">
        <h2 className="text-[16.5px] font-[650] tracking-[-0.02em]">{title}</h2>
        <p className="text-[13.5px] text-ink-muted">{description}</p>
      </header>
      <div className="flex flex-col gap-[22px] px-5 py-[22px] sm:px-6">{children}</div>
    </section>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[12.5px] font-[550] text-danger-fg">
      {message}
    </p>
  );
}

/** A labelled group of toggle chips (single or multi select). */
export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  multiple = false,
  error,
  hint,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  multiple?: boolean;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-[9px]" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-[9px] text-[13px] font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2" role={multiple ? "group" : "radiogroup"} aria-label={label}>
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role={multiple ? undefined : "radio"}
              aria-checked={multiple ? undefined : on}
              aria-pressed={multiple ? on : undefined}
              onClick={() => onToggle(option.value)}
              className={cn(
                "h-[38px] cursor-pointer rounded-full border px-3.5 text-[13.5px]",
                on ? "border-primary-strong bg-primary-strong font-semibold text-white" : "border-line bg-surface font-medium text-ink hover:bg-canvas",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-[12.5px] text-ink-muted">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}

/** Free-text tags (hashtags / mentions). Enter or comma adds a tag. */
export function TagInput({
  id,
  label,
  prefix,
  values,
  onChange,
  placeholder,
  error,
  hint,
}: {
  id: string;
  label: string;
  prefix: "#" | "@";
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  error?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const cleaned = draft.trim().replace(/^[#@]/, "").replace(/[,\s]+$/, "");
    if (!cleaned) return;
    const tag = `${prefix}${cleaned}`;
    if (!values.includes(tag)) onChange([...values, tag]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border bg-surface px-2.5 py-1.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(10,95,107,0.18)]",
          error ? "border-danger" : "border-line",
        )}
      >
        {values.map((value) => (
          <span key={value} className="flex items-center gap-1 rounded-chip bg-primary-100 py-1 pr-1 pl-2 text-[13px] font-[550] text-primary-hover">
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              aria-label={`Remove ${value}`}
              className="cursor-pointer rounded p-0.5 hover:bg-primary-150"
            >
              <X aria-hidden className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="min-w-[120px] flex-1 bg-transparent py-1.5 text-[14.5px] outline-none"
        />
      </div>
      {error ? <FieldError id={`${id}-error`} message={error} /> : hint ? <p id={`${id}-hint`} className="text-[12.5px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}
