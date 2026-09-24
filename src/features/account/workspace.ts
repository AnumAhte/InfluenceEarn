import type { Enums } from "@/lib/supabase/database.types";

export type Workspace = Enums<"workspace_role">;

export const WORKSPACES = ["advertiser", "influencer"] as const satisfies readonly Workspace[];

type WorkspaceCopy = {
  label: string;
  switchLabel: string;
  switchHint: string;
  setupTitle: string;
  setupDescription: string;
  setupPoints: readonly [string, string];
  setupCta: string;
};

export const WORKSPACE_COPY: Record<Workspace, WorkspaceCopy> = {
  advertiser: {
    label: "Advertiser",
    switchLabel: "Switch to Advertiser",
    switchHint: "Create and manage campaigns",
    setupTitle: "Advertiser",
    setupDescription: "Create campaigns and work with influencers.",
    setupPoints: [
      "Set requirements and payment per influencer",
      "Review submitted work and approve completion",
    ],
    setupCta: "Use as Advertiser",
  },
  influencer: {
    label: "Influencer",
    switchLabel: "Switch to Influencer",
    switchHint: "Find campaigns and submit work",
    setupTitle: "Influencer / Creator",
    setupDescription: "Discover campaigns and earn by completing creator tasks.",
    setupPoints: [
      "See payment per influencer before applying",
      "Connect a social account only when a campaign needs it",
    ],
    setupCta: "Use as Influencer",
  },
};

export function isWorkspace(value: unknown): value is Workspace {
  return typeof value === "string" && (WORKSPACES as readonly string[]).includes(value);
}
