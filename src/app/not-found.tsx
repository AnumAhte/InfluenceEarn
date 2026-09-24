import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-[-0.025em]">Page not found</h1>
        <p className="text-[15px] text-ink-secondary">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      </div>
      <Button asChild>
        <Link href="/">Go to the homepage</Link>
      </Button>
    </main>
  );
}
