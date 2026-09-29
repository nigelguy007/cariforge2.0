// @polsia:user-owned — shared route-handler helpers for the fundraise loop:
// the admin session gate (401/403, same shape as /api/admin/leads), JSON body
// parsing, and the domain-error → HTTP status mapping (no stack leaks).

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { auth } from '@/lib/auth';
import { ConflictError, NotFoundError, TransitionError } from './errors';

export async function requireAdminSession(): Promise<
  { email: string; response?: never } | { response: NextResponse; email?: never }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { email: session.user.email };
}

/** Parses a JSON body against a schema; returns data or a 400 response. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T>; response?: never } | { response: NextResponse; data?: never }> {
  const raw = await req.json().catch(() => undefined);
  if (raw === undefined) {
    return { response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_root';
      if (!errors[key]) errors[key] = issue.message;
    }
    return { response: NextResponse.json({ errors }, { status: 400 }) };
  }
  return { data: parsed.data };
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof TransitionError || err instanceof ConflictError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  // biome-ignore lint/suspicious/noConsole: server-side ops log for unexpected loop failures (no stack returned to the client)
  console.error('[fundraise-loop]', err instanceof Error ? err.message : err);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
