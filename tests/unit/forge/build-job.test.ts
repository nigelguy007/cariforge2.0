// @vitest-environment node — build-job.ts imports 'server-only' directly;
// see tests/unit/forge/auto-advance.test.ts's header comment for why jsdom
// (the suite default) can't run this without it.
//
// @polsia:user-owned — coverage for the resumable SoftwareBuild job
// (build-job.ts). Every request through the production www.cariforge.com
// rewrite must finish under Vercel's 120s proxied-request limit, so these
// tests pin: one AI call per request, every call's timeout <= 100s, an
// over-long plan trimmed rather than rejected, and a failed file retried
// on the NEXT poll (up to 3 attempts) instead of failing the whole build.
// The database, AI client and handoff/review services are all faked.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { advanceSoftwareBuildJob, type BuildJobResult } from '@/lib/business/forge/build-job';
import { runMarker } from '@/lib/business/forge/build-job-markers';

vi.mock('server-only', () => ({}));

interface FakeJob {
  id: string;
  missionId: string;
  createdById: string;
  status: string;
  plan: unknown;
  files: unknown;
  nextFileIndex: number;
  error: string | null;
  createdAt: Date;
}

const db = vi.hoisted(() => {
  const jobs: FakeJob[] = [];
  let seq = 0;
  const softwareBuildJob = {
    findFirst: vi.fn(async (args: { where: { missionId: string; status: { in: string[] } } }) => {
      const matches = jobs
        .filter(
          (j) => j.missionId === args.where.missionId && args.where.status.in.includes(j.status),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return matches[0] ? { ...matches[0] } : null;
    }),
    create: vi.fn(
      async (args: { data: { missionId: string; createdById: string; status: string } }) => {
        seq += 1;
        const job: FakeJob = {
          id: `job-${seq}`,
          missionId: args.data.missionId,
          createdById: args.data.createdById,
          status: args.data.status,
          plan: null,
          files: [],
          nextFileIndex: 0,
          error: null,
          createdAt: new Date(Date.now() + seq),
        };
        jobs.push(job);
        return { ...job };
      },
    ),
    update: vi.fn(async (args: { where: { id: string }; data: Partial<FakeJob> }) => {
      const job = jobs.find((j) => j.id === args.where.id);
      if (!job) throw new Error(`no job ${args.where.id}`);
      Object.assign(job, args.data);
      return { ...job };
    }),
    // Conditional write: only rows matching every `where` field are updated.
    updateMany: vi.fn(
      async (args: {
        where: { id: string; status?: string; nextFileIndex?: number; error?: string | null };
        data: Partial<FakeJob>;
      }) => {
        const { id, status, nextFileIndex } = args.where;
        const hits = jobs.filter(
          (j) =>
            j.id === id &&
            (status === undefined || j.status === status) &&
            (nextFileIndex === undefined || j.nextFileIndex === nextFileIndex) &&
            // Prisma semantics: `error: null` matches IS NULL; absent = any.
            (!('error' in args.where) || j.error === args.where.error),
        );
        for (const j of hits) Object.assign(j, args.data);
        return { count: hits.length };
      },
    ),
    findUnique: vi.fn(async (args: { where: { id: string } }) => {
      const job = jobs.find((j) => j.id === args.where.id);
      return job ? { ...job } : null;
    }),
  };
  return { jobs, prisma: { softwareBuildJob } };
});
vi.mock('@/lib/db', () => ({ prisma: db.prisma }));

interface ParseCall {
  body: { max_tokens: number; system: string };
  options: { timeout: number };
}

const ai = vi.hoisted(() => {
  const calls: ParseCall[] = [];
  const parse = vi.fn();
  const client = { messages: { parse } };
  return { calls, parse, client, getClient: vi.fn(() => client) };
});
vi.mock('@/lib/business/forge/ai-draft', () => ({ getClient: ai.getClient }));

const service = vi.hoisted(() => ({ submitHandoff: vi.fn(), getMissionDetail: vi.fn() }));
vi.mock('@/lib/business/forge/service', () => service);

const autoAdvance = vi.hoisted(() => ({ reviewAndMaybeAdvance: vi.fn() }));
vi.mock('@/lib/business/forge/auto-advance', () => autoAdvance);

const MISSION = 'mission-1';

const ARGS = {
  missionId: MISSION,
  userId: 'user-1',
  isAdmin: false,
  ownerUserId: 'user-1',
  need: 'Track insurance claims and their required disclosures.',
  priorContext: [],
  feedback: [],
  evidence: [],
} as const;

function planWith(fileCount: number) {
  return {
    summary: 'A claims tracker.',
    scope: ['claims'],
    checksPassed: ['builds'],
    missingEvidence: [],
    architectureOverview: 'Next.js app.',
    techStack: ['Next.js'],
    dataModel: 'Claim',
    apiSurface: ['GET /api/claims'],
    deploymentNotes: 'Set DATABASE_URL.',
    files: Array.from({ length: fileCount }, (_, i) => ({
      path: `src/file-${i}.ts`,
      purpose: `File ${i}.`,
    })),
    confidence: 0.8,
  };
}

/** Script the next AI call to resolve with this parsed output. */
function nextResolves(parsedOutput: unknown) {
  ai.parse.mockImplementationOnce(
    async (body: ParseCall['body'], options: ParseCall['options']) => {
      ai.calls.push({ body, options });
      return { parsed_output: parsedOutput };
    },
  );
}

/** Script the next AI call to reject with this error. */
function nextRejects(err: Error) {
  ai.parse.mockImplementationOnce(
    async (body: ParseCall['body'], options: ParseCall['options']) => {
      ai.calls.push({ body, options });
      throw err;
    },
  );
}

const timeoutErr = () => new Error('Request timed out.');
const truncatedErr = () =>
  new Error('Unterminated string in JSON at position 30210 (line 1 column 30211)');

/** Seed a job already mid-generation, as the Planning step would leave it. */
function seedGeneratingJob(opts: { fileCount?: number; nextFileIndex?: number; error?: string }) {
  const plan = planWith(opts.fileCount ?? 3);
  const nextFileIndex = opts.nextFileIndex ?? 0;
  const job: FakeJob = {
    id: 'seeded',
    missionId: MISSION,
    createdById: 'user-1',
    status: 'Generating',
    plan,
    files: plan.files
      .slice(0, nextFileIndex)
      .map((f) => ({ path: f.path, content: `// ${f.path}` })),
    nextFileIndex,
    error: opts.error ?? null,
    createdAt: new Date(),
  };
  db.jobs.push(job);
  return job;
}

/** The single job these tests create or seed. */
function onlyJob(): FakeJob {
  const job = db.jobs[0];
  if (!job) throw new Error('expected a SoftwareBuildJob to exist');
  return job;
}

/** The nth recorded AI call (0-based). */
function call(n: number): ParseCall {
  const c = ai.calls[n];
  if (!c) throw new Error(`expected AI call #${n}`);
  return c;
}

/** Seed a job still in Planning, e.g. with another request's plan lease. */
function seedPlanningJob(error: string | null) {
  const job: FakeJob = {
    id: 'seeded',
    missionId: MISSION,
    createdById: 'user-1',
    status: 'Planning',
    plan: null,
    files: [],
    nextFileIndex: 0,
    error,
    createdAt: new Date(),
  };
  db.jobs.push(job);
  return job;
}

/** No marker (lease or retry) may ever leak into a response. */
function expectNoMarker(result: BuildJobResult) {
  expect(JSON.stringify(result)).not.toMatch(/\b(run|retry):/);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Let pending promise chains (fake DB + fake AI calls) run to completion. */
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.useRealTimers();
  db.jobs.length = 0;
  ai.calls.length = 0;
  ai.parse.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('advanceSoftwareBuildJob — Planning', () => {
  it('keeps only the first 20 files when the model returns more (instead of rejecting the plan)', async () => {
    nextResolves(planWith(23));
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Generating', progress: { current: 0, total: 20 } });
    const job = onlyJob();
    expect(job.status).toBe('Generating');
    const files = (job.plan as { files: { path: string }[] }).files;
    expect(files).toHaveLength(20);
    expect(files.map((f) => f.path)).toEqual(
      Array.from({ length: 20 }, (_, i) => `src/file-${i}.ts`),
    );
  });

  it('a first failed plan keeps the job Planning with a plan retry marker', async () => {
    nextRejects(truncatedErr());
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Planning' });
    expect(onlyJob().status).toBe('Planning');
    expect(onlyJob().error).toBe('retry:plan:1');
    expect(console.warn).toHaveBeenCalled();
  });

  it('a plan that fails once then succeeds moves to Generating with the marker cleared', async () => {
    nextRejects(timeoutErr());
    await advanceSoftwareBuildJob({ ...ARGS });
    nextResolves(planWith(8));
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Generating', progress: { current: 0, total: 8 } });
    expect(onlyJob().status).toBe('Generating');
    expect(onlyJob().error).toBeNull();
    expect(db.jobs).toHaveLength(1);
  });

  it('marks the job Failed with the existing message when the plan fails twice', async () => {
    nextRejects(truncatedErr());
    await advanceSoftwareBuildJob({ ...ARGS });
    nextRejects(truncatedErr());
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({
      status: 'Failed',
      error: 'CARIForge could not plan this build right now. Try again shortly.',
    });
    expect(onlyJob().status).toBe('Failed');
    expect(onlyJob().error).toBe('CARIForge could not plan this build right now.');
  });

  it('plans with max_tokens 8000, a 115s timeout, and asks for 8-15 files', async () => {
    nextResolves(planWith(10));
    await advanceSoftwareBuildJob({ ...ARGS });

    expect(ai.calls).toHaveLength(1);
    expect(call(0).body.max_tokens).toBe(8_000);
    expect(call(0).options.timeout).toBe(115_000);
    expect(call(0).body.system).toContain('8-15');
  });
});

describe('advanceSoftwareBuildJob — Generating retries across polls', () => {
  it('a timed-out first attempt keeps the job Generating on the same file and records the attempt', async () => {
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    nextRejects(timeoutErr());
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Generating', progress: { current: 1, total: 3 } });
    const job = onlyJob();
    expect(job.status).toBe('Generating');
    expect(job.nextFileIndex).toBe(1);
    expect(job.files).toHaveLength(1);
    expect(job.error).toBe('retry:1:1');
    expect(ai.calls).toHaveLength(1);
    expect(call(0).body.max_tokens).toBe(8_192);
    expect(call(0).options.timeout).toBe(100_000);
    expect(console.warn).toHaveBeenCalled();
  });

  it('escalates to 12_000 tokens / 125s on attempt 2, still Generating after a truncation', async () => {
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    nextRejects(timeoutErr());
    await advanceSoftwareBuildJob({ ...ARGS });
    nextRejects(truncatedErr());
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Generating', progress: { current: 1, total: 3 } });
    expect(onlyJob().status).toBe('Generating');
    expect(onlyJob().error).toBe('retry:1:2');
    expect(ai.calls).toHaveLength(2);
    expect(call(1).body.max_tokens).toBe(12_000);
    expect(call(1).options.timeout).toBe(125_000);
  });

  it('fails the job with the human message after the 3rd failed attempt on the same file', async () => {
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    nextRejects(timeoutErr());
    await advanceSoftwareBuildJob({ ...ARGS });
    nextRejects(truncatedErr());
    await advanceSoftwareBuildJob({ ...ARGS });
    nextRejects(timeoutErr());
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({
      status: 'Failed',
      error: 'CARIForge could not generate src/file-1.ts. Try again shortly.',
    });
    expect(onlyJob().status).toBe('Failed');
    expect(onlyJob().error).toBe('CARIForge could not generate src/file-1.ts.');
    expect(ai.calls).toHaveLength(3);
    expect(call(2).body.max_tokens).toBe(20_000);
    expect(call(2).options.timeout).toBe(230_000);
  });

  it('treats a null parsed_output as a retryable failure too', async () => {
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 0 });
    nextResolves(null);
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Generating', progress: { current: 0, total: 3 } });
    expect(onlyJob().error).toBe('retry:0:1');
  });

  it('a failure followed by a success appends the file, advances the index and clears the marker', async () => {
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    nextRejects(timeoutErr());
    await advanceSoftwareBuildJob({ ...ARGS });
    nextResolves({ content: 'export const ok = true;\n' });
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Generating', progress: { current: 2, total: 3 } });
    const job = onlyJob();
    expect(job.nextFileIndex).toBe(2);
    expect(job.error).toBeNull();
    const files = job.files as { path: string; content: string }[];
    expect(files).toHaveLength(2);
    expect(files[1]).toEqual({ path: 'src/file-1.ts', content: 'export const ok = true;\n' });
  });

  it('ignores a stale retry marker left for a different file index', async () => {
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 2, error: 'retry:1:2' });
    nextRejects(timeoutErr());
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Generating', progress: { current: 2, total: 3 } });
    expect(onlyJob().status).toBe('Generating');
    expect(onlyJob().error).toBe('retry:2:1');
    expect(call(0).body.max_tokens).toBe(8_192);
  });

  it('makes exactly one AI call per request, with the per-attempt budgets, across a full build', async () => {
    service.submitHandoff.mockResolvedValue({ handoffs: [] });
    service.getMissionDetail.mockResolvedValue({ mission: { id: MISSION } });

    // [script, expected max_tokens, expected timeout] per poll.
    const steps: Array<[() => void, number, number]> = [
      [() => nextRejects(timeoutErr()), 8_000, 115_000], // plan, attempt 1
      [() => nextResolves(planWith(5)), 8_000, 115_000], // plan, attempt 2
      [() => nextRejects(timeoutErr()), 8_192, 100_000], // file 0, attempt 1
      [() => nextRejects(truncatedErr()), 12_000, 125_000], // file 0, attempt 2
      [() => nextResolves({ content: 'a' }), 20_000, 230_000], // file 0, attempt 3
      [() => nextResolves({ content: 'b' }), 8_192, 100_000],
      [() => nextRejects(timeoutErr()), 8_192, 100_000],
      [() => nextResolves({ content: 'c' }), 12_000, 125_000],
      [() => nextResolves({ content: 'd' }), 8_192, 100_000],
      [() => nextResolves({ content: 'e' }), 8_192, 100_000],
    ];
    for (const [i, [script, maxTokens, timeout]] of steps.entries()) {
      script();
      const result = await advanceSoftwareBuildJob({ ...ARGS });
      expectNoMarker(result);
      expect(ai.calls).toHaveLength(i + 1);
      expect(call(i).body.max_tokens).toBe(maxTokens);
      expect(call(i).options.timeout).toBe(timeout);
      expect(result.status).not.toBe('Failed');
    }
    // Finalize: no AI call.
    const final = await advanceSoftwareBuildJob({ ...ARGS });
    expect(ai.calls).toHaveLength(steps.length);
    expect(final.status).toBe('Done');
    expect(onlyJob().status).toBe('Done');
    expect((onlyJob().files as unknown[]).length).toBe(5);
    // The plan call always stays under the 120s rewrite limit.
    for (const c of ai.calls.filter((c) => c.body.max_tokens === 8_000)) {
      expect(c.options.timeout).toBeLessThanOrEqual(115_000);
    }
  });
});

describe('advanceSoftwareBuildJob — overlapping requests', () => {
  /** Script the next AI call to succeed, after mutating the job mid-call
   *  the way a second, overlapping request would. */
  function nextResolvesAfter(mutate: (job: FakeJob) => void, parsedOutput: unknown) {
    ai.parse.mockImplementationOnce(
      async (body: ParseCall['body'], options: ParseCall['options']) => {
        ai.calls.push({ body, options });
        mutate(onlyJob());
        return { parsed_output: parsedOutput };
      },
    );
  }

  it('does not overwrite a job another request already advanced past this file', async () => {
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    const theirFiles = [
      { path: 'src/file-0.ts', content: '// src/file-0.ts' },
      { path: 'src/file-1.ts', content: 'theirs' },
    ];
    nextResolvesAfter(
      (job) => {
        job.nextFileIndex = 2;
        job.files = theirFiles;
      },
      { content: 'mine' },
    );
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Generating', progress: { current: 2, total: 3 } });
    expect(onlyJob().nextFileIndex).toBe(2);
    expect(onlyJob().files).toEqual(theirFiles);
  });

  it('does not write a retry marker onto a job that was marked Failed meanwhile', async () => {
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    ai.parse.mockImplementationOnce(
      async (body: ParseCall['body'], options: ParseCall['options']) => {
        ai.calls.push({ body, options });
        onlyJob().status = 'Failed';
        onlyJob().error = 'CARIForge could not generate src/file-1.ts.';
        throw timeoutErr();
      },
    );
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result.status).toBe('Failed');
    expect(onlyJob().error).toBe('CARIForge could not generate src/file-1.ts.');
  });

  it('returns the finished mission when another request already completed the build', async () => {
    service.getMissionDetail.mockResolvedValue({ mission: { id: MISSION } });
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 2 });
    nextResolvesAfter(
      (job) => {
        job.status = 'Done';
        job.nextFileIndex = 3;
      },
      { content: 'mine' },
    );
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Done', detail: { mission: { id: MISSION } } });
    expect(onlyJob().status).toBe('Done');
  });

  it('does not overwrite a plan another request already saved', async () => {
    nextResolvesAfter((job) => {
      job.status = 'Generating';
      job.plan = planWith(9);
    }, planWith(12));
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Generating', progress: { current: 0, total: 9 } });
    expect((onlyJob().plan as { files: unknown[] }).files).toHaveLength(9);
  });
});

describe('advanceSoftwareBuildJob — single-flight lease per step', () => {
  const T0 = 1_800_000_000_000;

  function useClock(at = T0) {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
    vi.setSystemTime(at);
  }

  it('records a run lease while the attempt is in flight', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    const release = deferred<{ parsed_output: unknown }>();
    ai.parse.mockImplementationOnce(
      async (body: ParseCall['body'], options: ParseCall['options']) => {
        ai.calls.push({ body, options });
        return release.promise;
      },
    );
    const pending = advanceSoftwareBuildJob({ ...ARGS });
    await flush();
    expect(onlyJob().error).toBe(runMarker(1, 1, T0));

    release.resolve({ parsed_output: { content: 'ok' } });
    const result = await pending;
    expect(result).toEqual({ status: 'Generating', progress: { current: 2, total: 3 } });
    expect(onlyJob().error).toBeNull();
  });

  it('a second request during an in-flight attempt makes no AI call and returns once the job moves', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1, error: runMarker(1, 1, T0 - 10_000) });
    const pending = advanceSoftwareBuildJob({ ...ARGS });
    await vi.advanceTimersByTimeAsync(6_000);
    // The in-flight attempt (another request) saves its file.
    const job = onlyJob();
    job.nextFileIndex = 2;
    job.files = [...(job.files as unknown[]), { path: 'src/file-1.ts', content: 'theirs' }];
    job.error = null;
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await pending;

    expect(result).toEqual({ status: 'Generating', progress: { current: 2, total: 3 } });
    expect(ai.calls).toHaveLength(0);
    expect(Date.now() - T0).toBeLessThan(10_000);
  });

  it('a second request during an in-flight attempt returns current progress after ~25s', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1, error: runMarker(1, 3, T0 - 150_000) });
    const pending = advanceSoftwareBuildJob({ ...ARGS });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(6_000);
    const result = await pending;

    expect(result).toEqual({ status: 'Generating', progress: { current: 1, total: 3 } });
    expectNoMarker(result);
    expect(ai.calls).toHaveLength(0);
    expect(Date.now() - T0).toBeLessThan(30_000);
    expect(onlyJob().error).toBe(runMarker(1, 3, T0 - 150_000));
  });

  it('counts a stale run lease as a failed attempt and starts the next one', async () => {
    useClock();
    // Attempt 1's lease is older than its 100s timeout + 30s grace: the
    // function holding it was killed before it could write a result.
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1, error: runMarker(1, 1, T0 - 131_000) });
    nextRejects(timeoutErr());
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(ai.calls).toHaveLength(1);
    expect(call(0).body.max_tokens).toBe(12_000);
    expect(result).toEqual({ status: 'Generating', progress: { current: 1, total: 3 } });
    expect(onlyJob().error).toBe('retry:1:2');
  });

  it('a stale lease on the last attempt fails the job with the human message', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1, error: runMarker(1, 3, T0 - 261_000) });
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(ai.calls).toHaveLength(0);
    expect(result).toEqual({
      status: 'Failed',
      error: 'CARIForge could not generate src/file-1.ts. Try again shortly.',
    });
    expect(onlyJob().status).toBe('Failed');
    expect(onlyJob().error).toBe('CARIForge could not generate src/file-1.ts.');
  });

  it('makes no AI call when another request wins the claim', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    db.prisma.softwareBuildJob.updateMany.mockImplementationOnce(async () => {
      // Someone else claimed this step between our read and our claim.
      onlyJob().error = runMarker(1, 1, T0 - 1);
      return { count: 0 };
    });
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(ai.calls).toHaveLength(0);
    expect(result).toEqual({ status: 'Generating', progress: { current: 1, total: 3 } });
    expect(onlyJob().error).toBe(runMarker(1, 1, T0 - 1));
  });

  it('attempt3-dupfail: a re-poll after a lost reply waits for the original attempt 3 instead of duplicating it', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1, error: 'retry:1:2' });
    const original = deferred<{ parsed_output: unknown }>();
    ai.parse.mockImplementationOnce(
      async (body: ParseCall['body'], options: ParseCall['options']) => {
        ai.calls.push({ body, options });
        return original.promise;
      },
    );
    // If a duplicate attempt were ever started, it would fail.
    ai.parse.mockImplementation(async (body: ParseCall['body'], options: ParseCall['options']) => {
      ai.calls.push({ body, options });
      throw timeoutErr();
    });

    const requestA = advanceSoftwareBuildJob({ ...ARGS });
    await flush();
    expect(call(0).body.max_tokens).toBe(20_000);

    // The proxy drops A's reply at 120s; the client re-polls 45s later.
    vi.setSystemTime(T0 + 165_000);
    const results: BuildJobResult[] = [];
    const requestB = advanceSoftwareBuildJob({ ...ARGS });
    await vi.advanceTimersByTimeAsync(26_000);
    results.push(await requestB);
    expect(results[0]).toEqual({ status: 'Generating', progress: { current: 1, total: 3 } });

    // Another re-poll while A is still running; A then succeeds.
    const requestC = advanceSoftwareBuildJob({ ...ARGS });
    await vi.advanceTimersByTimeAsync(4_000);
    original.resolve({ parsed_output: { content: 'good' } });
    results.push(await requestA);
    await vi.advanceTimersByTimeAsync(2_000);
    results.push(await requestC);

    expect(ai.calls).toHaveLength(1);
    expect(results[1]).toEqual({ status: 'Generating', progress: { current: 2, total: 3 } });
    expect(results[2]).toEqual({ status: 'Generating', progress: { current: 2, total: 3 } });
    for (const r of results) expectNoMarker(r);
    const job = onlyJob();
    expect(job.status).toBe('Generating');
    expect(job.error).toBeNull();
    expect((job.files as { content: string }[])[1]?.content).toBe('good');
  });

  it('discards a successful result when its lease was taken over as stale', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    const takeover = runMarker(1, 2, T0 + 200_000);
    ai.parse.mockImplementationOnce(
      async (body: ParseCall['body'], options: ParseCall['options']) => {
        ai.calls.push({ body, options });
        onlyJob().error = takeover; // a later request judged our lease stale
        return { parsed_output: { content: 'late' } };
      },
    );
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result).toEqual({ status: 'Generating', progress: { current: 1, total: 3 } });
    expect(onlyJob().nextFileIndex).toBe(1);
    expect(onlyJob().files).toHaveLength(1);
    expect(onlyJob().error).toBe(takeover);
  });

  it('plan step: a second request during an in-flight plan makes no AI call', async () => {
    useClock();
    seedPlanningJob(runMarker('plan', 1, T0 - 5_000));
    const timedOut = advanceSoftwareBuildJob({ ...ARGS });
    await vi.advanceTimersByTimeAsync(26_000);
    expect(await timedOut).toEqual({ status: 'Planning' });

    const moved = advanceSoftwareBuildJob({ ...ARGS });
    await vi.advanceTimersByTimeAsync(1_000);
    const job = onlyJob();
    job.status = 'Generating';
    job.plan = planWith(9);
    job.error = null;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await moved).toEqual({ status: 'Generating', progress: { current: 0, total: 9 } });
    expect(ai.calls).toHaveLength(0);
  });

  it('plan step: a stale plan lease counts as the first attempt', async () => {
    useClock();
    seedPlanningJob(runMarker('plan', 1, T0 - 146_000));
    nextRejects(timeoutErr());
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(ai.calls).toHaveLength(1);
    expect(result).toEqual({
      status: 'Failed',
      error: 'CARIForge could not plan this build right now. Try again shortly.',
    });
    expect(onlyJob().error).toBe('CARIForge could not plan this build right now.');
  });

  it("F1: a waiter whose DB read throws leaves the job (and the holder's lease) untouched", async () => {
    useClock();
    const lease = runMarker(1, 1, T0 - 5_000);
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1, error: lease });
    db.prisma.softwareBuildJob.findUnique.mockRejectedValueOnce(new Error('db blip'));
    const pending = advanceSoftwareBuildJob({ ...ARGS });
    await vi.advanceTimersByTimeAsync(3_000);
    const result = await pending;

    expect(result).toEqual({
      status: 'Failed',
      error: 'CARIForge could not continue this build right now. Try again shortly.',
    });
    expect(onlyJob().status).toBe('Generating');
    expect(onlyJob().error).toBe(lease);
  });

  it('F1: a lease holder whose write throws marks the job Failed', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    const real = db.prisma.softwareBuildJob.updateMany.getMockImplementation();
    if (!real) throw new Error('expected a fake updateMany');
    db.prisma.softwareBuildJob.updateMany
      .mockImplementationOnce(real) // the claim
      .mockImplementationOnce(async () => {
        throw new Error('db blip');
      });
    nextResolves({ content: 'ok' });
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result.status).toBe('Failed');
    expect(onlyJob().status).toBe('Failed');
    expect(onlyJob().error).toBe('Unexpected error');
  });

  it('F1: a former lease holder whose write throws does not fail a job someone else now holds', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 3, nextFileIndex: 1 });
    const takeover = runMarker(1, 2, T0 + 1);
    const real = db.prisma.softwareBuildJob.updateMany.getMockImplementation();
    if (!real) throw new Error('expected a fake updateMany');
    db.prisma.softwareBuildJob.updateMany
      .mockImplementationOnce(real)
      .mockImplementationOnce(async () => {
        throw new Error('db blip');
      });
    ai.parse.mockImplementationOnce(
      async (body: ParseCall['body'], options: ParseCall['options']) => {
        ai.calls.push({ body, options });
        onlyJob().error = takeover;
        return { parsed_output: { content: 'late' } };
      },
    );
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result.status).toBe('Failed');
    expect(onlyJob().status).toBe('Generating');
    expect(onlyJob().error).toBe(takeover);
  });

  it('F1: an error after the job is Done never flips it back to Failed', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 1, nextFileIndex: 1 });
    onlyJob().status = 'Finalizing';
    service.submitHandoff.mockResolvedValueOnce({ handoffs: [] });
    service.getMissionDetail.mockRejectedValueOnce(new Error('db blip'));
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result.status).toBe('Failed');
    expect(onlyJob().status).toBe('Done');
  });

  it('F3: a second concurrent finalize makes no submitHandoff call and returns Done once the first finishes', async () => {
    useClock();
    seedGeneratingJob({ fileCount: 2, nextFileIndex: 2 });
    onlyJob().status = 'Finalizing';
    service.submitHandoff.mockReset();
    service.getMissionDetail.mockReset();
    service.getMissionDetail.mockResolvedValue({ mission: { id: MISSION } });
    const handoff = deferred<{ handoffs: unknown[] }>();
    service.submitHandoff.mockReturnValueOnce(handoff.promise);

    const first = advanceSoftwareBuildJob({ ...ARGS });
    await flush();
    expect(onlyJob().error).toBe(runMarker('finalize', 1, T0));

    const second = advanceSoftwareBuildJob({ ...ARGS });
    await vi.advanceTimersByTimeAsync(4_000);
    handoff.resolve({ handoffs: [] });
    const firstResult = await first;
    await vi.advanceTimersByTimeAsync(2_000);
    const secondResult = await second;

    expect(service.submitHandoff).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual({ status: 'Done', detail: { mission: { id: MISSION } } });
    expect(secondResult).toEqual({ status: 'Done', detail: { mission: { id: MISSION } } });
    expect(onlyJob().status).toBe('Done');
    expect(onlyJob().error).toBeNull();
  });

  it('F3: a stale finalize lease fails the job instead of submitting twice', async () => {
    useClock();
    seedGeneratingJob({
      fileCount: 1,
      nextFileIndex: 1,
      error: runMarker('finalize', 1, T0 - 181_000),
    });
    onlyJob().status = 'Finalizing';
    service.submitHandoff.mockReset();
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(service.submitHandoff).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'Failed',
      error: 'CARIForge could not continue this build right now. Try again shortly.',
    });
    expect(onlyJob().status).toBe('Failed');
  });
});
