// @polsia:user-owned — GET /api/fundraise-loop/runner/exclusions. Every
// identity already known to the loop, for 8Raise upload_exclusion_list.

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/business/fundraise-loop/http';
import { requireRunner } from '@/lib/business/fundraise-loop/runner-auth';
import { exclusionList } from '@/lib/business/fundraise-loop/store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = requireRunner(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ items: await exclusionList() });
  } catch (err) {
    return errorResponse(err);
  }
}
