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
    | { error?: unknown; errors?: unknown }
    | undefined;
  if (cause && typeof cause.error === 'string' && cause.error.trim()) return cause.error;
  // Real gap found live (2026-09-05): a 400 validation failure responds
  // `{ errors: Record<string,string> }` (every /api/forge/* POST route's
  // own `fieldErrorBody` convention), not `{ error: string }` — a caller
  // with no form fields to attribute errors to (a chat UI, not a form)
  // had no way to surface it and fell straight through to the generic
  // fallback, hiding the real validation reason from both the user and
  // whoever debugged it. Join the field messages into one readable line.
  if (cause && cause.errors && typeof cause.errors === 'object') {
    const messages = Object.values(cause.errors as Record<string, unknown>).filter(
      (m): m is string => typeof m === 'string' && m.trim().length > 0,
    );
    if (messages.length > 0) return messages.join(' ');
  }
  return fallback;
}
