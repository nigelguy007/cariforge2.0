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
import { advanceSoftwareBuildJob } from '@/lib/business/forge/build-job';

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
        where: { id: string; status?: string; nextFileIndex?: number };
        data: Partial<FakeJob>;
      }) => {
        const { id, status, nextFileIndex } = args.where;
        const hits = jobs.filter(
          (j) =>
            j.id === id &&
            (status === undefined || j.status === status) &&
            (nextFileIndex === undefined || j.nextFileIndex === nextFileIndex),
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

beforeEach(() => {
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
      error: 'CariForge could not plan this build right now. Try again shortly.',
    });
    expect(onlyJob().status).toBe('Failed');
    expect(onlyJob().error).toBe('CariForge could not plan this build right now.');
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
      error: 'CariForge could not generate src/file-1.ts. Try again shortly.',
    });
    expect(onlyJob().status).toBe('Failed');
    expect(onlyJob().error).toBe('CariForge could not generate src/file-1.ts.');
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
        onlyJob().error = 'CariForge could not generate src/file-1.ts.';
        throw timeoutErr();
      },
    );
    const result = await advanceSoftwareBuildJob({ ...ARGS });

    expect(result.status).toBe('Failed');
    expect(onlyJob().error).toBe('CariForge could not generate src/file-1.ts.');
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
