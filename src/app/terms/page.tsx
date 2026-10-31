import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_DOCUMENTS_APPROVED, LegalPage, LegalSection, List, Placeholder } from "@/features/legal/components/legal-document";

export const metadata: Metadata = {
  title: "Terms of Service",
  robots: LEGAL_DOCUMENTS_APPROVED ? undefined : { index: false, follow: false },
};

// Draft. Describes how the product works today; every legal choice is a <Placeholder> for the client
// and their lawyer. Do not add claims (guarantees, liability limits, jurisdictions) without approval.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p className="text-[13px] text-ink-muted">
        Version: draft · Effective date: <Placeholder>effective date</Placeholder>
      </p>

      <LegalSection title="1. Who we are">
        <p>
          InfluencEarn (&ldquo;the platform&rdquo;) is operated by <Placeholder>legal entity name, registration number and
          registered address</Placeholder>. Questions about these terms: <Placeholder>contact email</Placeholder>.
        </p>
      </LegalSection>

      <LegalSection title="2. The service">
        <p>InfluencEarn is a marketplace where advertisers run influencer campaigns and influencers apply to complete them.</p>
        <List>
          <li>Advertisers create campaigns with requirements, tasks, deadlines and a fixed payment per creator.</li>
          <li>Influencers apply with their linked social accounts. Advertisers choose creators manually; applying does not guarantee selection.</li>
          <li>Selected influencers submit proof of the completed work (for example a link to the post). The advertiser approves it, rejects it, or asks for changes.</li>
          <li>Approved work is paid out to the influencer by the platform team after review.</li>
        </List>
        <p>
          Follower counts and social account details are entered by influencers and are not verified by the platform.
          Advertisers should review each applicant&apos;s profile themselves.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts">
        <List>
          <li>You must give accurate information and keep your password secure. You are responsible for activity on your account.</li>
          <li>Minimum age to use the platform: <Placeholder>minimum age</Placeholder>.</li>
          <li>One account can be used as an advertiser, an influencer, or both.</li>
          <li>
            We may suspend an account that breaks these terms. A suspended user can&apos;t sign in or use the platform;
            their existing records are kept. <Placeholder>notice and appeal process for suspensions</Placeholder>
          </li>
        </List>
      </LegalSection>

      <LegalSection title="4. Fees and payments">
        <List>
          <li>Campaigns are funded from the advertiser&apos;s wallet before they are published. Funding covers the creator budget (payment per creator × number of creators) plus a 20% platform fee on that budget.</li>
          <li>
            When a campaign is completed, creator budget that was not used is returned to the advertiser&apos;s wallet.
            The platform fee is currently not refunded. <Placeholder>client approval of the fee refund policy</Placeholder>
          </li>
          <li>Influencers are paid the stated amount per approved submission. <Placeholder>payout timing, methods, minimums and any provider fees</Placeholder></li>
          <li>
            Payments are processed by <Placeholder>payment and payout provider</Placeholder>. Adding funds and releasing
            payouts are not available until a provider is connected.
          </li>
          <li><Placeholder>taxes, invoices and who is responsible for them</Placeholder></li>
        </List>
      </LegalSection>

      <LegalSection title="5. Campaign rules">
        <List>
          <li>Campaign content and budget are locked once a campaign is funded.</li>
          <li>Influencers must follow each campaign&apos;s instructions, meet its deadlines, and disclose paid partnerships as required by law and by each social platform&apos;s rules.</li>
          <li>Advertisers must give a reason when rejecting work and must not request content that is unlawful, deceptive or against a platform&apos;s rules.</li>
          <li><Placeholder>prohibited content and conduct list</Placeholder></li>
          <li><Placeholder>dispute process between advertisers and influencers</Placeholder></li>
        </List>
      </LegalSection>

      <LegalSection title="6. Content and intellectual property">
        <p><Placeholder>ownership and licence of content created for campaigns, and of material uploaded to the platform</Placeholder></p>
      </LegalSection>

      <LegalSection title="7. Liability, termination and changes">
        <List>
          <li><Placeholder>limitation of liability and disclaimers</Placeholder></li>
          <li><Placeholder>how users can close their account and what happens to wallet balances</Placeholder></li>
          <li><Placeholder>how changes to these terms are announced</Placeholder></li>
          <li><Placeholder>governing law and jurisdiction</Placeholder></li>
        </List>
      </LegalSection>

      <p>
        How we handle personal data is described in the <Link href="/privacy" className="font-[550] text-primary-strong hover:text-primary-hover">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
