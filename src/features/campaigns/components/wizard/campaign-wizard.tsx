"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  campaignDraftSchema,
  stepIssues,
  WIZARD_STEPS,
  type CampaignDraftInput,
  type WizardStep,
} from "@/domain/campaigns/schemas";

import { saveCampaignDraft } from "../../actions";
import { StepBudget } from "./step-budget";
import { StepDetails } from "./step-details";
import { StepInstructions } from "./step-instructions";
import { StepPlatformsTasks } from "./step-platforms-tasks";
import { WizardPreview } from "./wizard-preview";
import { WizardStepper } from "./wizard-stepper";

const STEP_FIELDS: Record<WizardStep, readonly string[]> = {
  1: ["title", "description", "categorySlug", "campaignType", "eligibility"],
  2: ["platforms", "tasks"],
  3: ["instructions", "captionInstructions", "hashtags", "mentions", "referenceUrl", "applicationDeadline", "taskDeadline"],
  4: ["paymentPerCreator", "creatorsRequired"],
};

function stepOf(path: string): WizardStep {
  const root = path.split(".")[0] ?? "";
  for (const step of [1, 2, 3, 4] as const) {
    if (STEP_FIELDS[step].includes(root)) return step;
  }
  return 1;
}

type Errors = Record<string, string>;

/**
 * 4-step create/edit wizard. React Hook Form holds the state; Zod validates each
 * step before continuing; the server validates everything again on save.
 */
export function CampaignWizard({
  initialValues,
  campaignId: initialCampaignId,
  today,
}: {
  initialValues: CampaignDraftInput;
  campaignId: string | null;
  today: string;
}) {
  const form = useForm<CampaignDraftInput>({ defaultValues: initialValues });
  const [step, setStep] = useState<WizardStep>(1);
  const [errors, setErrors] = useState<Errors>({});
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pendingIntent, setPendingIntent] = useState<"save" | "continue" | null>(null);
  const [, startTransition] = useTransition();

  const stepsWithErrors = new Set(Object.keys(errors).map(stepOf));
  const meta = WIZARD_STEPS[step - 1];

  /** Shape errors for all steps + completeness issues for the given steps. */
  function validate(completeSteps: readonly WizardStep[]): Errors {
    const parsed = campaignDraftSchema.safeParse(form.getValues());
    const found: Errors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".");
        found[key] ??= issue.message;
      }
      return found;
    }
    for (const s of completeSteps) {
      for (const issue of stepIssues(s, parsed.data, today)) found[issue.path] ??= issue.message;
    }
    return found;
  }

  function goTo(target: WizardStep) {
    if (target > step) {
      const found = validate(Array.from({ length: target - 1 }, (_, i) => (i + 1) as WizardStep));
      const blocking = Object.keys(found).filter((path) => stepOf(path) < target);
      if (blocking.length > 0) {
        setErrors(found);
        setStep(stepOf(blocking[0]!));
        setMessage({ tone: "danger", text: "Fix the highlighted fields to continue." });
        return;
      }
    }
    setErrors({});
    setMessage(null);
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit(intent: "save" | "continue") {
    const found = validate(intent === "continue" ? [1, 2, 3, 4] : []);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setStep(stepOf(Object.keys(found)[0]!));
      setMessage({
        tone: "danger",
        text: intent === "continue" ? "Complete every step before continuing to funding." : "Fix the highlighted fields to save the draft.",
      });
      return;
    }

    setPendingIntent(intent);
    startTransition(async () => {
      const result = await saveCampaignDraft({ campaignId, intent, draft: form.getValues() });
      // "continue" redirects to the funding page on success; nothing to update here.
      if (!result) return;
      setPendingIntent(null);
      if (result.status === "error") {
        setErrors(result.fieldErrors ?? {});
        const first = Object.keys(result.fieldErrors ?? {})[0];
        if (first) setStep(stepOf(first));
        setMessage({ tone: "danger", text: result.message });
        return;
      }
      setCampaignId(result.campaignId);
      setErrors({});
      form.reset(form.getValues());
      if (!campaignId) window.history.replaceState(null, "", `/campaigns/${result.campaignId}/edit`);
      setMessage({
        tone: "success",
        text: `Draft saved at ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(result.savedAt))}.`,
      });
    });
  }

  const busy = pendingIntent !== null;

  return (
    <FormProvider {...form}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[28px]">{meta.label}</h1>
          <p className="text-[15px] leading-relaxed text-ink-secondary sm:text-[15.5px]">{meta.description}</p>
        </div>

        <WizardStepper step={step} onSelect={goTo} stepsWithErrors={stepsWithErrors} />

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (step < 4) goTo((step + 1) as WizardStep);
            else submit("continue");
          }}
          className="grid items-start gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]"
        >
          <div className="flex min-w-0 flex-col gap-5">
            {message ? (
              <Callout tone={message.tone}>
                <span role={message.tone === "danger" ? undefined : "status"}>{message.text}</span>
              </Callout>
            ) : null}

            {step === 1 ? <StepDetails errors={errors} /> : null}
            {step === 2 ? <StepPlatformsTasks errors={errors} /> : null}
            {step === 3 ? <StepInstructions errors={errors} today={today} /> : null}
            {step === 4 ? <StepBudget errors={errors} /> : null}

            <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:rounded-card sm:border sm:px-5 sm:py-4 sm:shadow-xs">
              <Button type="button" variant="secondary" onClick={() => goTo(Math.max(1, step - 1) as WizardStep)} disabled={step === 1 || busy} aria-label="Back">
                <ArrowLeft aria-hidden className="size-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <span className="hidden text-[13px] text-ink-muted md:inline">Step {step} of 4</span>
              <div className="flex items-center gap-2.5">
                <Button type="button" variant="secondary" onClick={() => submit("save")} pending={pendingIntent === "save"} disabled={busy}>
                  Save draft
                </Button>
                <Button type="submit" pending={pendingIntent === "continue"} disabled={busy} className="shadow-primary">
                  {step < 4 ? (
                    <>
                      Continue
                      <ArrowRight aria-hidden className="size-4" />
                    </>
                  ) : (
                    "Continue to funding"
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden lg:block">
            <WizardPreview control={form.control} />
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
