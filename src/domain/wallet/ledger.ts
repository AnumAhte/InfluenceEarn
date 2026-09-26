import { addCents, assertSupportedCurrency, cents, type Cents } from "../money";
import { calculateCampaignFunding } from "../pricing";

/**
 * Internal accounting model. This is NOT a regulated wallet and does not represent
 * money held on anyone's behalf; real money movement requires a payment provider.
 *
 * The authoritative implementation is in Postgres
 * (supabase/migrations/20260925091000_wallet_ledger.sql). This module holds the
 * shared pure rules plus `LedgerModel`, an in-memory executable specification of
 * the same behaviour used by unit tests. pgTAP tests check the SQL against the
 * same scenarios.
 */

export type LedgerEntryType =
  | "mock_deposit"
  | "campaign_funding_debit"
  | "campaign_funding_reserve"
  | "platform_fee";

export type LedgerEntry = {
  accountId: string;
  entryType: LedgerEntryType;
  amountCents: Cents;
};

/** Balance is always derived from entries — there is no stored balance. */
export function balanceOf(entries: readonly LedgerEntry[], accountId: string): Cents {
  return addCents(...entries.filter((e) => e.accountId === accountId).map((e) => e.amountCents));
}

export function isBalanced(entries: readonly LedgerEntry[]): boolean {
  return entries.reduce((sum, e) => sum + e.amountCents, 0) === 0 && entries.every((e) => e.amountCents !== 0);
}

export type FundingAssessment =
  | { sufficient: true; requiredCents: Cents; availableCents: Cents; shortfallCents: Cents }
  | { sufficient: false; requiredCents: Cents; availableCents: Cents; shortfallCents: Cents };

export function assessFunding(requiredCents: Cents, availableCents: Cents): FundingAssessment {
  const shortfall = Math.max(0, requiredCents - availableCents);
  return {
    sufficient: shortfall === 0,
    requiredCents,
    availableCents,
    shortfallCents: cents(shortfall),
  } as FundingAssessment;
}

export class LedgerError extends Error {
  constructor(
    readonly code:
      | "invalid_amount"
      | "insufficient_funds"
      | "invalid_campaign_state"
      | "campaign_not_found"
      | "idempotency_key_reused",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "LedgerError";
  }
}

type ModelCampaign = {
  id: string;
  ownerId: string;
  status: "funding_required" | "applications_open" | string;
  paymentPerCreatorCents: Cents;
  creatorsRequired: number;
};

type DepositRecord = { key: string; amountCents: Cents; transactionId: string };
type FundingRecord = { campaignId: string; totalCents: Cents; transactionId: string };

/** In-memory executable specification of the SQL ledger functions. */
export class LedgerModel {
  private readonly entries: LedgerEntry[] = [];
  private readonly journal = new Map<string, readonly LedgerEntry[]>();
  private readonly deposits = new Map<string, DepositRecord>();
  private readonly fundings = new Map<string, FundingRecord>();
  private readonly campaigns = new Map<string, ModelCampaign>();
  private sequence = 0;

  static walletId(userId: string) {
    return `wallet:${userId}`;
  }

  addCampaign(campaign: ModelCampaign) {
    this.campaigns.set(campaign.id, { ...campaign });
  }

  campaignStatus(id: string) {
    return this.campaigns.get(id)?.status;
  }

  balance(userId: string): Cents {
    return balanceOf(this.entries, LedgerModel.walletId(userId));
  }

  allEntries(): readonly LedgerEntry[] {
    return [...this.entries];
  }

  transactionCount(): number {
    return this.journal.size;
  }

  private post(lines: LedgerEntry[]): string {
    if (!isBalanced(lines)) throw new Error("Unbalanced journal");
    const id = `tx_${++this.sequence}`;
    this.journal.set(id, Object.freeze([...lines]));
    this.entries.push(...lines);
    return id;
  }

  /** Mirrors `record_test_deposit` (succeeded outcome). */
  recordTestDeposit(userId: string, amountCents: number, currency: string, key: string) {
    assertSupportedCurrency(currency);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 10_000_000) {
      throw new LedgerError("invalid_amount");
    }
    const dedupeKey = `${userId}:${key}`;
    const existing = this.deposits.get(dedupeKey);
    if (existing) {
      if (existing.amountCents !== amountCents) throw new LedgerError("idempotency_key_reused");
      return { transactionId: existing.transactionId, replayed: true };
    }
    const amount = cents(amountCents);
    const transactionId = this.post([
      { accountId: LedgerModel.walletId(userId), entryType: "mock_deposit", amountCents: amount },
      { accountId: "clearing:mock", entryType: "mock_deposit", amountCents: cents(-amount) },
    ]);
    this.deposits.set(dedupeKey, { key, amountCents: amount, transactionId });
    return { transactionId, replayed: false };
  }

  /** Mirrors `fund_and_publish_campaign`. Amounts are always recomputed here. */
  fundAndPublish(userId: string, campaignId: string) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.ownerId !== userId) throw new LedgerError("campaign_not_found");

    const existing = this.fundings.get(campaignId);
    if (existing) return { ...existing, alreadyFunded: true };

    if (campaign.status !== "funding_required") throw new LedgerError("invalid_campaign_state");

    const funding = calculateCampaignFunding(campaign.paymentPerCreatorCents, campaign.creatorsRequired);
    const assessment = assessFunding(funding.totalFunding, this.balance(userId));
    if (!assessment.sufficient) throw new LedgerError("insufficient_funds");

    const lines: LedgerEntry[] = [
      { accountId: LedgerModel.walletId(userId), entryType: "campaign_funding_debit", amountCents: cents(-funding.totalFunding) },
      { accountId: `reserve:${campaignId}`, entryType: "campaign_funding_reserve", amountCents: funding.creatorBudget },
    ];
    if (funding.platformFee > 0) {
      lines.push({ accountId: "platform:revenue", entryType: "platform_fee", amountCents: funding.platformFee });
    }
    const transactionId = this.post(lines);
    const record = { campaignId, totalCents: funding.totalFunding, transactionId };
    this.fundings.set(campaignId, record);
    campaign.status = "applications_open";
    return { ...record, alreadyFunded: false };
  }
}
