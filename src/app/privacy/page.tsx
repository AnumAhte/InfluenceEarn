import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_DOCUMENTS_APPROVED, LegalPage, LegalSection, List, Placeholder } from "@/features/legal/components/legal-document";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: LEGAL_DOCUMENTS_APPROVED ? undefined : { index: false, follow: false },
};

// Draft. The data inventory below reflects what the code actually stores; keep it in sync with the
// schema. Legal bases, retention and transfers are <Placeholder>s for the client and their lawyer.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-[13px] text-ink-muted">
        Version: draft · Effective date: <Placeholder>effective date</Placeholder>
      </p>

      <LegalSection title="1. Who is responsible">
        <p>
          The data controller is <Placeholder>legal entity name and registered address</Placeholder>. Privacy questions and
          requests: <Placeholder>privacy contact email</Placeholder>. <Placeholder>data protection officer or EU/UK representative, if required</Placeholder>
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <List>
          <li><strong className="font-[650] text-ink">Account:</strong> email address, password (stored hashed by our authentication provider), full name, and optionally phone number, city, a short bio and a profile photo.</li>
          <li><strong className="font-[650] text-ink">Influencer details:</strong> country, date of birth, gender, content categories, linked social account handles and the follower counts you enter, and an optional media kit (PDF).</li>
          <li><strong className="font-[650] text-ink">Marketplace activity:</strong> campaigns, applications, selections, submitted proof links and comment text, reviews and their reasons.</li>
          <li><strong className="font-[650] text-ink">Money records:</strong> wallet transactions, campaign funding, refunds and payouts.</li>
          <li><strong className="font-[650] text-ink">Notifications:</strong> the in-app notifications we send you, whether a notification email was sent, and your email preferences.</li>
          <li><strong className="font-[650] text-ink">Security records:</strong> administrator actions (for example payout decisions and account suspensions) and the reasons recorded for them.</li>
        </List>
      </LegalSection>

      <LegalSection title="3. What advertisers see">
        <p>
          When you apply to a campaign, the advertiser sees a snapshot taken at that moment: your name, city, country, age
          (not your date of birth), gender, categories, and the social accounts and follower counts you applied with. They
          can also open your media kit while your application is visible to them. Advertisers do not see your email
          address, phone number or wallet.
        </p>
      </LegalSection>

      <LegalSection title="4. Why we use it">
        <List>
          <li>To run your account and the marketplace (eligibility checks, applications, reviews, payouts).</li>
          <li>To send service notifications in the app and, if you allow it, by email.</li>
          <li>To keep the platform secure and to keep accurate financial records.</li>
          <li><Placeholder>legal basis for each purpose (e.g. contract, legitimate interests, legal obligation)</Placeholder></li>
        </List>
        <p>The platform does not use advertising or analytics trackers. <Placeholder>commitment on selling or sharing personal data</Placeholder></p>
      </LegalSection>

      <LegalSection title="5. Cookies">
        <p>We use only the cookies needed to keep you signed in. <Placeholder>confirm whether a cookie notice is required in your markets</Placeholder></p>
      </LegalSection>

      <LegalSection title="6. Service providers">
        <List>
          <li>Supabase — hosting, database, authentication and file storage. Region: <Placeholder>hosting region</Placeholder></li>
          <li>Email delivery: <Placeholder>email (SMTP) provider</Placeholder></li>
          <li>Payments and payouts: <Placeholder>payment provider, once chosen</Placeholder></li>
          <li><Placeholder>international transfer safeguards</Placeholder></li>
        </List>
      </LegalSection>

      <LegalSection title="7. How long we keep it">
        <p>
          Financial records and the administrator activity log are append-only and are kept to meet accounting and audit
          obligations. <Placeholder>retention periods for each category of data</Placeholder>
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>
          You can view and edit your profile, creator details, social accounts and email preferences in Settings at any time.
          <Placeholder>rights available in your markets (access, deletion, portability, objection, complaint to a regulator) and how to exercise them</Placeholder>
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p><Placeholder>minimum age and handling of accounts of minors</Placeholder></p>
      </LegalSection>

      <p>
        See also the <Link href="/terms" className="font-[550] text-primary-strong hover:text-primary-hover">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
