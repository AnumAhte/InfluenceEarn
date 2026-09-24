"use client";

import { useEffect, useId, useState } from "react";

import { AVATAR_MIME_TYPES, validateAvatarFile } from "../schemas";

/**
 * File input for the optional profile photo, with a local preview.
 * The selected file is submitted with the surrounding form (field name "avatar").
 */
export function AvatarPicker({
  initials,
  currentUrl,
  error,
  onValidationChange,
}: {
  initials: string;
  currentUrl: string | null;
  error?: string;
  onValidationChange: (error: string | undefined) => void;
}) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const shownUrl = previewUrl ?? currentUrl;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPreviewUrl(null);
      onValidationChange(undefined);
      return;
    }
    const check = validateAvatarFile(file);
    if (!check.ok) {
      event.target.value = "";
      setPreviewUrl(null);
      onValidationChange(check.error);
      return;
    }
    onValidationChange(undefined);
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-canvas p-4 sm:flex-nowrap sm:gap-5 sm:p-5">
        <span className="relative flex size-14 flex-none items-center justify-center overflow-hidden rounded-full bg-night text-[19px] font-[650] tracking-[-0.02em] text-white sm:size-16 sm:text-[22px]">
          {shownUrl ? (
            // Local object URLs and signed storage URLs cannot go through the image optimiser.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownUrl} alt="Your profile photo" className="size-full object-cover" />
          ) : (
            <span aria-hidden>{initials}</span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[14.5px] font-semibold">Profile photo</span>
          <span id={`${inputId}-hint`} className="text-[13.5px] leading-normal text-ink-secondary">
            JPG or PNG, up to 2 MB. Optional.
          </span>
        </div>
        <label
          htmlFor={inputId}
          className="inline-flex h-10 cursor-pointer items-center rounded-control border border-line bg-surface px-4 text-sm font-[550] text-ink transition-colors hover:bg-surface-muted has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
        >
          {shownUrl ? "Change photo" : "Upload photo"}
          <input
            id={inputId}
            name="avatar"
            type="file"
            accept={AVATAR_MIME_TYPES.join(",")}
            onChange={handleChange}
            aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
            aria-invalid={error ? true : undefined}
            className="sr-only"
          />
        </label>
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-[13px] font-medium text-danger-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
