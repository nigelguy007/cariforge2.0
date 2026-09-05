// @polsia:user-owned — extracts the real error message from an apiFetch
// failure. apiFetch (framework-owned, src/lib/api-client.ts) always throws
// `new Error(\`apiFetch <path> failed (<status>)\`, { cause: body })` — the
// server's own curated message (every /api/forge/* route responds
// `{ error: string }` on failure, see forgeErrorResponse) lands ONLY in
// `err.cause`, never in `err.message`. Every catch block across the app
// that read `.message` instead was showing the user that generic
// "apiFetch ... failed (503)" string instead of the real explanation.
//
// Caught 2026-09-05 via a live user report on "Draft with AI" (fixed first
// in next-action-card.tsx); this file generalises that fix so every other
// call site can use the same one-line extraction instead of repeating the
// unsafe cast.
export function apiErrorMessage(err: unknown, fallback: string): string {
  const cause = (err as { cause?: unknown } | null | undefined)?.cause as
    | { error?: unknown }
    | undefined;
  if (cause && typeof cause.error === 'string' && cause.error.trim()) return cause.error;
  return fallback;
}
