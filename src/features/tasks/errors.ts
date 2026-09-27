/** Maps errors from submit_task_completion / review_task_submission / lifecycle RPCs to copy. */
export function describeTaskError(error: { message?: string; code?: string }): string {
  const message = error.message ?? "";
  if (message.startsWith("invalid_proof: url_required")) return "A required link is missing.";
  if (message.startsWith("invalid_proof: url_platform")) return "One of the links isn't on the right platform.";
  if (message.startsWith("invalid_proof: comment_required")) return "Paste the comment you posted.";
  if (message.startsWith("invalid_proof")) return "Complete the proof for every task.";
  if (message.startsWith("deadline_passed")) return "The task deadline has passed, so submissions are closed.";
  if (message.startsWith("attempts_exhausted")) return "You've used all your submission attempts for this task.";
  if (message.startsWith("submission_not_allowed")) return "You can't submit right now. Refresh to see the latest status.";
  if (message.startsWith("assignment_not_found") || message.startsWith("submission_not_found")) return "Not found.";
  if (message.startsWith("reason_required")) return "Tell the creator what needs to change.";
  if (message.startsWith("review_not_allowed")) return "This submission has already been reviewed.";
  if (message.startsWith("work_outstanding")) {
    return "Some work is still waiting for review or can still be submitted before the deadline.";
  }
  if (message.startsWith("no_selected_creators")) return "Select at least one creator before starting the work.";
  if (message.startsWith("invalid_campaign_transition")) return "That isn't possible for this campaign right now.";
  return "Something went wrong. Please try again.";
}
