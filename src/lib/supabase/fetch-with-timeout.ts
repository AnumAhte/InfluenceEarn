/**
 * fetch for server-side Supabase clients: a stalled upstream request fails after 15 s instead of
 * holding the page (or server action) open indefinitely.
 */
export const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;

export const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};
