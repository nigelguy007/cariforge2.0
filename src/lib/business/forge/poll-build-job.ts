// @polsia:user-owned — the client's SoftwareBuild poll loop (2026-09-28),
// pulled out of next-action-card.tsx's runBuildJob so it can be unit
// tested. Pure: no server imports, no fetch — the caller supplies `poll`
// (apiFetch against build-job/route.ts, parsed with BuildJobProgress).
//
// Why LOST replies are tolerated: users reach the app through the
// www.cariforge.com/888 Vercel rewrite, which cuts a proxied request off
// at 120s. Confirmed in the local e2e harness (real UI behind a proxy with
// that cutoff): a file attempt that legitimately ran 122s (attempt 2,
// within its 125s budget — see build-job.ts's FILE_ATTEMPTS) reached the
// browser as a bodiless HTTP 502 at 120s, apiFetch threw with a null
// cause, and the build aborted with "Could not draft this step" — even
// though the server saved that file 2s later. Attempt 3 (230s) always
// outlasts the cutoff. So a reply with no body is treated as "lost, not
// failed": wait for the in-flight server step to finish and persist, then
// poll again. Overlapping requests are safe: the server's plan/file writes
// are conditional on the step still being current, so a request that lost
// that race reports the job's current state instead of overwriting it.
import type { z } from 'zod';
import type { BuildJobProgress, MissionDetailT } from '@/lib/contracts/forge';

type BuildJobProgressT = z.infer<typeof BuildJobProgress>;

// A hard cap against ever polling forever if a real bug ever left a job
// stuck oscillating between states. Only a real reply that DIFFERS from
// the previous one (status, or progress current/total) counts: a lost
// reply didn't observe the job at all, and an unchanged reply is a retry
// or a server long-poll (~25s) waiting on another request's in-flight
// attempt — counting those let ~8 long attempt-3 files exhaust the cap.
// A legitimate build changes state at most ~23 times (Planning, 20 file
// positions, Finalizing, Done), so 64 is ample. Stuck-but-unchanged
// replies are bounded by MAX_BUILD_JOB_MS instead.
export const MAX_BUILD_JOB_POLLS = 64;
// Wall-clock backstop for the whole loop. Worst legitimate case is far
// below it: plan 2 x 115s + 20 files x (100 + 125 + 230)s + finalize
// ~= 2.6h is theoretically possible only if EVERY file needed all three
// attempts; a realistic build is 10-25 min. 45 min stops a truly stuck
// job; the job itself persists, so a later click resumes it.
export const MAX_BUILD_JOB_MS = 45 * 60_000;
// Long enough for the step whose reply was lost to finish and persist
// server-side before the next poll (the longest attempt runs 230s and the
// proxy gives up at 120s; later lost replies each buy another wait).
export const LOST_REPLY_WAIT_MS = 45_000;
export const MAX_LOST_REPLIES_IN_A_ROW = 3;

/** True when the request's reply never arrived: a network TypeError, or an
 *  apiFetch HTTP error with no JSON body (cause null/undefined — e.g. the
 *  proxy's bodiless 502/504). A JSON error body (cause object), a ZodError
 *  or a Failed status is a REAL answer and is never treated as lost. */
export function isLostReply(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  return (
    err instanceof Error &&
    err.message.startsWith('apiFetch') &&
    (err.cause === null || err.cause === undefined)
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polls the build job forward until Done (returning its detail) or a real
 *  failure (thrown, with `cause: { error }` where the caller toasts it). */
export async function pollBuildJob(args: {
  poll: () => Promise<BuildJobProgressT>;
  onProgress: (p: { current: number; total: number } | null) => void;
  wait?: (ms: number) => Promise<void>;
  /** Injectable clock (tests); defaults to Date.now. */
  now?: () => number;
}): Promise<MissionDetailT> {
  const wait = args.wait ?? sleep;
  const now = args.now ?? Date.now;
  const startedAt = now();
  let changes = 0;
  let previous: string | null = null;
  let lostInARow = 0;
  for (;;) {
    if (now() - startedAt >= MAX_BUILD_JOB_MS) throw tooLong();
    let result: BuildJobProgressT;
    try {
      result = await args.poll();
    } catch (err) {
      if (!isLostReply(err)) throw err;
      lostInARow += 1;
      if (lostInARow >= MAX_LOST_REPLIES_IN_A_ROW) throw err;
      await wait(LOST_REPLY_WAIT_MS);
      continue;
    }
    lostInARow = 0;
    if (result.status === 'Done') return result.detail;
    if (result.status === 'Failed')
      throw new Error(result.error, { cause: { error: result.error } });
    args.onProgress(result.status === 'Generating' ? result.progress : null);
    const key =
      result.status === 'Generating'
        ? `Generating:${result.progress.current}/${result.progress.total}`
        : result.status;
    if (key !== previous) {
      changes += 1;
      previous = key;
    }
    if (changes >= MAX_BUILD_JOB_POLLS) throw tooLong();
  }
}

function tooLong(): Error {
  return new Error('apiFetch build-job exceeded its poll cap', {
    cause: { error: 'This build is taking longer than expected. Try again shortly.' },
  });
}
