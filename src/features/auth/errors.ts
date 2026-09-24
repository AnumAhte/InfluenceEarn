/** Maps Supabase Auth error codes to user-facing copy. Unknown codes get a safe generic message. */
export function authErrorMessage(code: string | undefined, fallback = "Something went wrong. Please try again."): string {
  switch (code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Confirm your email address first. Check your inbox for the confirmation link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "weak_password":
      return "Choose a stronger password with at least 8 characters.";
    case "same_password":
      return "Your new password must be different from your current one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    case "signup_disabled":
      return "New sign-ups are currently disabled.";
    case "reauthentication_needed":
      return "For security, please sign in again before changing your password.";
    default:
      return fallback;
  }
}

/** Messages for `?error=` codes on the login page (e.g. expired email links). */
export const LOGIN_NOTICE: Record<string, string> = {
  link_invalid: "That link is invalid or has expired. Request a new one and try again.",
  session_expired: "Your session has ended. Please sign in again.",
};
