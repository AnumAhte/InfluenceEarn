export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 py-8 sm:items-center sm:px-8 sm:py-14">
      {children}
    </main>
  );
}
