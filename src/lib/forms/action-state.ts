import { z } from "zod";

/** Serializable result returned by form Server Actions. */
export type ActionState<Field extends string = string> =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<Field, string>>;
      /** Echo of non-secret submitted values so the form can be re-populated. */
      values?: Partial<Record<Field, string>>;
    }
  | { status: "success"; message: string; values?: Partial<Record<Field, string>> };

export const IDLE: ActionState<never> = { status: "idle" };

/** First validation message per field, in a shape forms can render directly. */
export function firstFieldErrors<Field extends string>(
  error: z.ZodError,
): Partial<Record<Field, string>> {
  const flattened = z.flattenError(error);
  const result: Partial<Record<Field, string>> = {};
  for (const [field, messages] of Object.entries(flattened.fieldErrors) as [Field, string[] | undefined][]) {
    if (messages?.[0]) result[field] = messages[0];
  }
  return result;
}

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
