import { describe, expect, it } from "vitest";

import { firstFieldErrors } from "@/lib/forms/action-state";

import { authErrorMessage } from "./errors";
import { signInSchema, signUpSchema } from "./schemas";

const validSignUp = {
  fullName: "Ayesha Khan",
  email: "  Ayesha@Example.COM ",
  password: "correct horse",
  confirmPassword: "correct horse",
};

describe("signUpSchema", () => {
  it("normalises email and trims the name", () => {
    const result = signUpSchema.parse({ ...validSignUp, fullName: "  Ayesha Khan " });
    expect(result.email).toBe("ayesha@example.com");
    expect(result.fullName).toBe("Ayesha Khan");
  });

  it("requires matching passwords", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, confirmPassword: "different" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstFieldErrors(result.error)).toEqual({ confirmPassword: "Passwords do not match" });
    }
  });

  it("enforces password length bounds", () => {
    const short = signUpSchema.safeParse({ ...validSignUp, password: "short", confirmPassword: "short" });
    const long = "x".repeat(73);
    const tooLong = signUpSchema.safeParse({ ...validSignUp, password: long, confirmPassword: long });
    expect(short.success).toBe(false);
    expect(tooLong.success).toBe(false);
  });

  it("rejects invalid email addresses", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstFieldErrors(result.error).email).toBe("Enter a valid email address");
  });
});

describe("signInSchema", () => {
  it("requires a password", () => {
    const result = signInSchema.safeParse({ email: "a@b.co", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("maps known codes and falls back safely", () => {
    expect(authErrorMessage("invalid_credentials")).toBe("Email or password is incorrect.");
    expect(authErrorMessage("something_new")).toBe("Something went wrong. Please try again.");
    expect(authErrorMessage(undefined, "Custom")).toBe("Custom");
  });
});
