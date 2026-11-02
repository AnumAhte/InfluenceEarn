/** Media kit rules shared by the upload action and the form. The bucket enforces size and type again. */
export const MEDIA_KIT_MAX_BYTES = 4 * 1024 * 1024;

export type MediaKitCheck = { ok: true } | { ok: false; error: string };

/** Checks size, declared type and the PDF signature ("%PDF-") of the first bytes. */
export function validateMediaKit(file: { size: number; type: string }, head: Uint8Array): MediaKitCheck {
  if (file.size === 0) return { ok: false, error: "The selected file is empty" };
  if (file.size > MEDIA_KIT_MAX_BYTES) return { ok: false, error: "Media kit must be 4 MB or smaller" };
  const signature = String.fromCharCode(...head.slice(0, 5));
  if (file.type !== "application/pdf" || signature !== "%PDF-") return { ok: false, error: "Media kit must be a PDF file" };
  return { ok: true };
}

/** Display name for the stored file: no path, no control characters, at most 120 characters. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
  return cleaned || "media-kit.pdf";
}
