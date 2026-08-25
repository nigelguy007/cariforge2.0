// @polsia:user-owned — GET /api/forge/admin/telemetry.
// Admin-only overview: autonomy ladder + per-company credit ledger
// + chat cost by day. requireForgeAdmin returns 401 signed-out, 403
// non-admin.
import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAdmin } from '@/lib/business/forge/api-helpers';
import { getAdminTelemetryOverview, getOperatorControlPlane } from '@/lib/business/forge/service';
import { AdminTelemetryOverview, OperatorControlPlane } from '@/lib/contracts/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireForgeAdmin(req);
  if (auth instanceof Response) return auth;
  try {
    const [overview, rows] = await Promise.all([
      getAdminTelemetryOverview(),
      getOperatorControlPlane(),
    ]);
    return NextResponse.json(
      {
        overview: AdminTelemetryOverview.parse(overview),
        controlPlane: OperatorControlPlane.parse({ rows }),
      },
      { status: 200 },
    );
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
