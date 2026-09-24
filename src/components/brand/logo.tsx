import Image from "next/image";

import { cn } from "@/lib/utils/cn";

type LogoProps = {
  /** "light" for white backgrounds, "dark" for night surfaces. */
  theme?: "light" | "dark";
  size?: "sm" | "md";
  className?: string;
};

/** InfluencEarn mark + "influencearn .com" wordmark, as in the approved designs. */
export function Logo({ theme = "light", size = "md", className }: LogoProps) {
  const markSize = size === "md" ? 30 : 28;
  const accent = theme === "dark" ? "text-brand-lime" : "text-brand-green";
  const accentBg = theme === "dark" ? "bg-brand-lime" : "bg-brand-green";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/brand/ie-mark.png"
        alt=""
        width={markSize}
        height={markSize}
        className={cn("block flex-none", size === "md" ? "rounded-[9px]" : "rounded-lg")}
        priority
      />
      <span className="flex flex-none flex-col gap-0.5 leading-none">
        <span
          className={cn(
            "font-bold tracking-[-0.025em]",
            size === "md" ? "text-base" : "text-[15px]",
            theme === "dark" ? "text-white" : "text-ink",
          )}
        >
          influence<span className={accent}>arn</span>
        </span>
        <span aria-hidden className="flex items-center gap-[3px]">
          <span className={cn("block h-px flex-1 opacity-65", accentBg)} />
          <span
            className={cn(
              "font-semibold tracking-[0.08em]",
              size === "md" ? "text-[8.3px]" : "text-[7.8px]",
              accent,
            )}
          >
            .com
          </span>
          <span className={cn("block h-px flex-1 opacity-65", accentBg)} />
        </span>
      </span>
    </span>
  );
}
