// @polsia:user-owned — coverage for the client's SoftwareBuild poll loop
// (poll-build-job.ts). The production rewrite cuts a request off at 120s
// with a bodiless 502 even when the server goes on to save that step, so
// a LOST reply (network TypeError, or an apiFetch HTTP error with no JSON
// body) must be waited out and re-polled, while every REAL error (JSON
// error body, schema drift, a Failed job) still surfaces immediately.

import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import {
  LOST_REPLY_WAIT_MS,
  MAX_BUILD_JOB_MS,
  MAX_BUILD_JOB_POLLS,
  MAX_LOST_REPLIES_IN_A_ROW,
  pollBuildJob,
} from '@/lib/business/forge/poll-build-job';
import type { MissionDetailT } from '@/lib/contracts/forge';

type Step = Parameters<typeof pollBuildJob>[0]['poll'] extends () => Promise<infer R> ? R : never;

const DETAIL = { mission: { id: 'mission-1' } } as unknown as MissionDetailT;
const PATH = '/api/forge/missions/mission-1/build-job';

/** What apiFetch throws for a non-2xx reply: cause is the parsed JSON body, or null. */
function httpError(status: number, body: unknown = null): Error {
  return new Error(`apiFetch ${PATH} failed (${status})`, { cause: body });
}

const generating = (current: number, total = 3): Step => ({
  status: 'Generating',
  progress: { current, total },
});
const done: Step = { status: 'Done', detail: DETAIL };

/** A poll function that plays back a script of replies (values) or throws (Errors). */
function scripted(script: Array<Step | Error>) {
  let i = 0;
  const poll = vi.fn(async (): Promise<Step> => {
    const next = script[i++];
    if (next === undefined) throw new Error('script exhausted');
    if (next instanceof Error) throw next;
    return next;
  });
  return poll;
}

function harness(script: Array<Step | Error>) {
  const poll = scripted(script);
  const onProgress = vi.fn();
  const wait = vi.fn(async (_ms: number) => {});
  return { poll, onProgress, wait };
}

describe('pollBuildJob', () => {
  it('polls straight through to Done, reporting progress on the way', async () => {
    const h = harness([
      { status: 'Planning' },
      generating(0),
      generating(1),
      generating(2),
      { status: 'Finalizing' },
      done,
    ]);
    await expect(pollBuildJob(h)).resolves.toBe(DETAIL);

    expect(h.poll).toHaveBeenCalledTimes(6);
    expect(h.onProgress.mock.calls).toEqual([
      [null],
      [{ current: 0, total: 3 }],
      [{ current: 1, total: 3 }],
      [{ current: 2, total: 3 }],
      [null],
    ]);
    expect(h.wait).not.toHaveBeenCalled();
  });

  it('waits out a bodiless 502 and carries on', async () => {
    const h = harness([generating(1), httpError(502), generating(3, 5), done]);
    await expect(pollBuildJob(h)).resolves.toBe(DETAIL);

    expect(h.poll).toHaveBeenCalledTimes(4);
    expect(h.wait).toHaveBeenCalledTimes(1);
    expect(h.wait).toHaveBeenCalledWith(45_000);
    expect(LOST_REPLY_WAIT_MS).toBe(45_000);
  });

  it('treats a network TypeError as a lost reply', async () => {
    const h = harness([new TypeError('Failed to fetch'), done]);
    await expect(pollBuildJob(h)).resolves.toBe(DETAIL);
    expect(h.wait).toHaveBeenCalledWith(45_000);
  });

  it('throws an HTTP error with a JSON body immediately, cause intact', async () => {
    const body = { status: 'Failed', error: 'CariForge could not plan this build right now.' };
    const err = httpError(503, body);
    const h = harness([err, done]);

    await expect(pollBuildJob(h)).rejects.toBe(err);
    expect((err.cause as { error: string }).error).toBe(body.error);
    expect(h.poll).toHaveBeenCalledTimes(1);
    expect(h.wait).not.toHaveBeenCalled();
  });

  it('throws a Failed reply (HTTP 200) with cause { error }', async () => {
    const h = harness([{ status: 'Failed', error: 'CariForge could not generate a.ts.' }, done]);
    const rejection = await pollBuildJob(h).catch((e: unknown) => e);

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe('CariForge could not generate a.ts.');
    expect((rejection as Error).cause).toEqual({ error: 'CariForge could not generate a.ts.' });
    expect(h.wait).not.toHaveBeenCalled();
  });

  it('does not treat a ZodError (schema drift) as a lost reply', async () => {
    const zerr = new ZodError([]);
    const h = harness([zerr, done]);
    await expect(pollBuildJob(h)).rejects.toBe(zerr);
    expect(h.wait).not.toHaveBeenCalled();
  });

  it('gives up after 3 lost replies in a row, throwing the last one', async () => {
    const last = httpError(504);
    const h = harness([
      generating(0),
      httpError(502),
      new TypeError('Failed to fetch'),
      last,
      done,
    ]);

    await expect(pollBuildJob(h)).rejects.toBe(last);
    expect(MAX_LOST_REPLIES_IN_A_ROW).toBe(3);
    expect(h.poll).toHaveBeenCalledTimes(4);
    expect(h.wait).toHaveBeenCalledTimes(2);
  });

  it('resets the lost-reply count after any real reply', async () => {
    const h = harness([
      httpError(502),
      httpError(502),
      generating(1),
      httpError(502),
      httpError(502),
      generating(2),
      done,
    ]);
    await expect(pollBuildJob(h)).resolves.toBe(DETAIL);
    expect(h.wait).toHaveBeenCalledTimes(4);
  });

  it('does not count lost replies against the poll cap', async () => {
    // MAX_BUILD_JOB_POLLS - 1 real Generating replies, each followed by a
    // lost reply, then Done on the last real poll: would blow a cap that
    // counted every attempt, but is within one that counts real replies.
    expect(MAX_BUILD_JOB_POLLS).toBe(64);
    const script: Array<Step | Error> = [];
    for (let i = 0; i < MAX_BUILD_JOB_POLLS - 1; i++)
      script.push(generating(i, 64), httpError(502));
    script.push(done);
    const h = harness(script);

    await expect(pollBuildJob(h)).resolves.toBe(DETAIL);
    expect(h.poll).toHaveBeenCalledTimes(2 * MAX_BUILD_JOB_POLLS - 1);
  });

  it('still stops at the poll cap when replies keep changing but never finish', async () => {
    const h = harness(Array.from({ length: MAX_BUILD_JOB_POLLS + 5 }, (_, i) => generating(i, 99)));
    const rejection = await pollBuildJob(h).catch((e: unknown) => e);

    expect(h.poll).toHaveBeenCalledTimes(MAX_BUILD_JOB_POLLS);
    expect((rejection as Error).cause).toEqual({
      error: 'This build is taking longer than expected. Try again shortly.',
    });
  });

  it('does not count unchanged replies (e.g. long-poll waits on one attempt) against the cap', async () => {
    const script: Array<Step | Error> = [{ status: 'Planning' }];
    for (let i = 0; i < 3 * MAX_BUILD_JOB_POLLS; i++) script.push(generating(1, 20));
    script.push(generating(2, 20), done);
    const h = harness(script);

    await expect(pollBuildJob(h)).resolves.toBe(DETAIL);
    expect(h.poll).toHaveBeenCalledTimes(3 * MAX_BUILD_JOB_POLLS + 3);
  });

  it('stops after MAX_BUILD_JOB_MS of wall-clock time even if replies never change', async () => {
    expect(MAX_BUILD_JOB_MS).toBe(45 * 60_000);
    let t = 0;
    const now = () => t;
    const poll = vi.fn(async (): Promise<Step> => {
      t += 30_000; // each long-poll reply takes ~30s
      return generating(1, 20);
    });
    const rejection = await pollBuildJob({ poll, onProgress: vi.fn(), wait: vi.fn(), now }).catch(
      (e: unknown) => e,
    );

    expect((rejection as Error).cause).toEqual({
      error: 'This build is taking longer than expected. Try again shortly.',
    });
    expect(t).toBeGreaterThanOrEqual(MAX_BUILD_JOB_MS);
    expect(t).toBeLessThan(MAX_BUILD_JOB_MS + 60_000);
  });

  it('the time backstop also covers lost replies', async () => {
    let t = 0;
    const poll = vi.fn(async (): Promise<Step> => {
      t += 10_000;
      // alternate lost / real so the lost-in-a-row limit never trips
      if (poll.mock.calls.length % 2 === 0) throw httpError(502);
      return generating(1, 20);
    });
    const wait = vi.fn(async (ms: number) => {
      t += ms;
    });
    const rejection = await pollBuildJob({ poll, onProgress: vi.fn(), wait, now: () => t }).catch(
      (e: unknown) => e,
    );
    expect((rejection as Error).cause).toEqual({
      error: 'This build is taking longer than expected. Try again shortly.',
    });
    expect(t).toBeLessThan(MAX_BUILD_JOB_MS + 60_000);
  });
});
