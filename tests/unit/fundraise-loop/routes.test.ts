// @vitest-environment node — the route handlers import 'server-only'.
// @polsia:user-owned — route-handler branches that need no database: the
// store and auth are mocked, so this pins validation (400), runner auth
// (401), the happy-path status (201), the admin role gate (403) and the
// state-machine conflict mapping (409).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransitionError } from '@/lib/business/fundraise-loop/state';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const getSession = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: () => getSession() } } }));

const store = {
  ingestBatch: vi.fn(),
  decideBatch: vi.fn(),
};
vi.mock('@/lib/business/fundraise-loop/store', () => store);

const TOKEN = 'runner-token-for-unit-tests-0123456789';
let savedToken: string | undefined;

beforeEach(() => {
  savedToken = process.env.FUNDRAISE_LOOP_TOKEN;
  process.env.FUNDRAISE_LOOP_TOKEN = TOKEN;
  vi.clearAllMocks();
});
afterEach(() => {
  if (savedToken === undefined) delete process.env.FUNDRAISE_LOOP_TOKEN;
  else process.env.FUNDRAISE_LOOP_TOKEN = savedToken;
});

const json = (url: string, method: string, body: unknown, auth?: string) =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });

const VALID_INGEST = {
  prospects: [
    {
      segmentKey: 'caribbean-latam-seed',
      fullName: 'Ada Investor',
      firm: 'Seed Co',
      linkedinUrl: 'https://www.linkedin.com/in/ada-investor/',
    },
  ],
};

describe('POST /api/fundraise-loop/runner/batches', () => {
  const url = 'http://localhost/api/fundraise-loop/runner/batches';

  it('401s without the runner token and never touches the store', async () => {
    const { POST } = await import('@/app/api/fundraise-loop/runner/batches/route');
    const res = await POST(json(url, 'POST', VALID_INGEST));
    expect(res.status).toBe(401);
    expect(store.ingestBatch).not.toHaveBeenCalled();
  });

  it('400s with field errors on an invalid body', async () => {
    const { POST } = await import('@/app/api/fundraise-loop/runner/batches/route');
    const res = await POST(json(url, 'POST', { prospects: [] }, `Bearer ${TOKEN}`));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toHaveProperty('prospects');
    expect(store.ingestBatch).not.toHaveBeenCalled();
  });

  it('400s on a non-JSON body', async () => {
    const { POST } = await import('@/app/api/fundraise-loop/runner/batches/route');
    const res = await POST(
      new Request(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}` },
        body: 'nope',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('201s with the ingest result on the happy path', async () => {
    const result = {
      batchId: 'b1',
      created: 1,
      duplicates: 0,
      warm: 0,
      unknownSegment: 0,
      invalid: 0,
    };
    store.ingestBatch.mockResolvedValue(result);
    const { POST } = await import('@/app/api/fundraise-loop/runner/batches/route');
    const res = await POST(json(url, 'POST', VALID_INGEST, `Bearer ${TOKEN}`));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(result);
    expect(store.ingestBatch).toHaveBeenCalledWith(VALID_INGEST);
  });

  it('500s without leaking the error on an unexpected failure', async () => {
    store.ingestBatch.mockRejectedValue(new Error('db exploded at /secret/path'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { POST } = await import('@/app/api/fundraise-loop/runner/batches/route');
    const res = await POST(json(url, 'POST', VALID_INGEST, `Bearer ${TOKEN}`));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
    spy.mockRestore();
  });
});

describe('PATCH /api/admin/fundraise/batches/[id]', () => {
  const url = 'http://localhost/api/admin/fundraise/batches/b1';
  const params = { params: Promise.resolve({ id: 'b1' }) };

  it('401s when signed out', async () => {
    getSession.mockResolvedValue(null);
    const { PATCH } = await import('@/app/api/admin/fundraise/batches/[id]/route');
    const res = await PATCH(json(url, 'PATCH', { action: 'approve' }), params);
    expect(res.status).toBe(401);
  });

  it('403s for a signed-in non-admin', async () => {
    getSession.mockResolvedValue({ user: { email: 'u@example.com', role: 'user' } });
    const { PATCH } = await import('@/app/api/admin/fundraise/batches/[id]/route');
    const res = await PATCH(json(url, 'PATCH', { action: 'approve' }), params);
    expect(res.status).toBe(403);
    expect(store.decideBatch).not.toHaveBeenCalled();
  });

  it('400s on an unknown action', async () => {
    getSession.mockResolvedValue({ user: { email: 'a@example.com', role: 'admin' } });
    const { PATCH } = await import('@/app/api/admin/fundraise/batches/[id]/route');
    const res = await PATCH(json(url, 'PATCH', { action: 'send' }), params);
    expect(res.status).toBe(400);
  });

  it('409s when the state machine refuses the move', async () => {
    getSession.mockResolvedValue({ user: { email: 'a@example.com', role: 'admin' } });
    store.decideBatch.mockRejectedValue(new TransitionError('SENT', 'APPROVED'));
    const { PATCH } = await import('@/app/api/admin/fundraise/batches/[id]/route');
    const res = await PATCH(json(url, 'PATCH', { action: 'approve' }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/SENT to APPROVED/);
    expect(store.decideBatch).toHaveBeenCalledWith('b1', { action: 'approve' }, 'a@example.com');
  });
});
