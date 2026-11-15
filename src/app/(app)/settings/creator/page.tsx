import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { latestAllowedBirthDate } from "@/domain/creators/schemas";
import { countryOptions } from "@/domain/geo/countries";
import { requireOnboardedAccount } from "@/features/account/queries";
import { CreatorDetailsForm } from "@/features/creators/components/creator-details-form";
import { MediaKitForm } from "@/features/creators/components/media-kit-form";
import { getMyCreatorDetails, getMyMediaKit } from "@/features/creators/queries";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "Creator details" };

export default async function CreatorDetailsPage() {
  const { userId } = await requireOnboardedAccount();
  const [details, mediaKit] = await Promise.all([getMyCreatorDetails(userId), getMyMediaKit(userId)]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <PageHeader
        title="Creator details"
        description="Some campaigns target a location, age, gender or category. Fill in what applies to you — it's all optional."
      />
      <Card className="px-5 py-6 sm:px-8 sm:py-8">
        <CreatorDetailsForm details={details} maxBirthDate={latestAllowedBirthDate(today)} countries={countryOptions()} />
      </Card>
      <Card className="flex flex-col gap-4 px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-[650] tracking-[-0.01em]">Media kit</h2>
          <p className="text-[13.5px] leading-relaxed text-ink-secondary">
            Optional. Advertisers can open it for campaigns you have applied to.
          </p>
        </div>
        <MediaKitForm mediaKit={mediaKit} />
      </Card>
      <p className="px-1 text-[13px] leading-relaxed text-ink-muted">
        These details stay private. When you apply, the advertiser sees a snapshot: your name, city, country, age (not your
        date of birth), gender if set, categories and the linked account the campaign requires.
      </p>
    </div>
  );
}
