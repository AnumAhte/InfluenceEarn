import { addCents, applyBasisPoints, multiplyCents, type Cents } from "./money";

/** Platform fee charged to advertisers on top of the creator budget: 20%. */
export const PLATFORM_FEE_BASIS_POINTS = 2_000;

export type CampaignFunding = {
  creatorBudget: Cents;
  platformFee: Cents;
  totalFunding: Cents;
};

/**
 * creator budget = creators × payment per creator
 * platform fee   = 20% of creator budget
 * total funding  = creator budget + platform fee
 */
export function calculateCampaignFunding(
  paymentPerCreator: Cents,
  creatorsRequired: number,
): CampaignFunding {
  if (paymentPerCreator <= 0) throw new RangeError("Payment per creator must be positive");
  if (!Number.isSafeInteger(creatorsRequired) || creatorsRequired < 1) {
    throw new RangeError("At least one creator is required");
  }
  const creatorBudget = multiplyCents(paymentPerCreator, creatorsRequired);
  const platformFee = applyBasisPoints(creatorBudget, PLATFORM_FEE_BASIS_POINTS);
  return { creatorBudget, platformFee, totalFunding: addCents(creatorBudget, platformFee) };
}
