"use client";

import { FileText } from "lucide-react";
import { useActionState } from "react";

import { Callout } from "@/components/ui/callout";
import { SubmitButton } from "@/components/ui/submit-button";
import { IDLE, type ActionState } from "@/lib/forms/action-state";

import { removeMediaKit, uploadMediaKit } from "../actions";
import type { MediaKit } from "../queries";

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function MediaKitForm({ mediaKit }: { mediaKit: MediaKit | null }) {
  const [uploadState, upload] = useActionState<ActionState, FormData>(uploadMediaKit, IDLE);
  const [removeState, remove] = useActionState<ActionState, FormData>(removeMediaKit, IDLE);
  const state = removeState.status !== "idle" && uploadState.status === "idle" ? removeState : uploadState;

  return (
    <div className="flex flex-col gap-4">
      {state.status === "error" ? <Callout tone="danger">{state.message}</Callout> : null}
      {state.status === "success" ? <Callout tone="success"><span role="status">{state.message}</span></Callout> : null}

      {mediaKit ? (
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-line px-3.5 py-3">
          <FileText aria-hidden className="size-5 shrink-0 text-primary" />
          <div className="flex min-w-0 flex-1 flex-col">
            {mediaKit.url ? (
              <a href={mediaKit.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-[550] text-primary-strong hover:text-primary-hover">
                {mediaKit.fileName}
              </a>
            ) : (
              <span className="truncate text-sm font-[550]">{mediaKit.fileName}</span>
            )}
            <span className="text-xs text-ink-muted">{formatSize(mediaKit.sizeBytes)} · uploaded {new Date(mediaKit.uploadedAt).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}</span>
          </div>
          <form action={remove}>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Removing…">Remove</SubmitButton>
          </form>
        </div>
      ) : null}

      <form action={upload} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="mediaKit" className="text-sm font-[550] text-ink-label">{mediaKit ? "Replace media kit" : "Upload a media kit"}</label>
          <input
            id="mediaKit"
            name="mediaKit"
            type="file"
            accept="application/pdf,.pdf"
            required
            aria-describedby="mediaKit-hint"
            className="w-full text-sm file:mr-3 file:rounded-control file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-[550] file:text-ink hover:file:bg-canvas"
          />
          <span id="mediaKit-hint" className="text-xs text-ink-muted">PDF, up to 4 MB.</span>
        </div>
        <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
      </form>
    </div>
  );
}
