import { formatMoney, type Cents } from "@/domain/money";

/**
 * Balance card. The balance is an internal accounting record derived from ledger
 * entries; it is not a bank account or a regulated wallet.
 */
export function WalletSummary({ availableCents, testMode }: { availableCents: Cents; testMode: boolean }) {
  return (
    <section aria-labelledby="wallet-balance-title" className="flex flex-col gap-4 rounded-card bg-night p-6 text-white sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="wallet-balance-title" className="text-[12.5px] font-semibold tracking-[0.06em] text-ink-disabled uppercase">
          Available balance
        </h2>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-primary-200">USD only</span>
      </div>
      <p className="tabular text-[40px] leading-none font-bold tracking-[-0.03em]">{formatMoney(availableCents)}</p>
      <p className="max-w-[520px] text-[13px] leading-relaxed text-ink-subtle">
        Calculated from your transaction history. Campaigns are funded from this balance when you publish them.
        {testMode ? " In this development environment, the balance comes from test funds only." : " No payment provider is connected yet, so funds can't be added."}
      </p>
    </section>
  );
}
