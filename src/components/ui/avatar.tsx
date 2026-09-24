import Image from "next/image";

import { cn } from "@/lib/utils/cn";

/** Rounded-square avatar with initials fallback. `src` may be a short-lived signed URL. */
export function Avatar({
  name,
  initials,
  src,
  size = 30,
  className,
}: {
  name: string;
  initials: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex flex-none items-center justify-center overflow-hidden rounded-[9px] bg-night font-bold text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {src ? (
        // Signed storage URLs expire, so bypass the image optimiser cache.
        <Image src={src} alt={name} fill sizes={`${size}px`} unoptimized className="object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
      {!src ? <span className="sr-only">{name}</span> : null}
    </span>
  );
}
