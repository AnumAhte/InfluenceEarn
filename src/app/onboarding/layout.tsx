import { AuthLogoLink } from "@/features/auth/components/auth-card";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-6 sm:px-10 sm:pt-8">
        <AuthLogoLink />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:px-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
