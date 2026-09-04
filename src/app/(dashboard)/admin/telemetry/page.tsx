// @polsia:user-owned — Admin telemetry page (Server Component shell).
// Server-only metadata + admin guard + island composition. No `await prisma`
// in the render layer — the islands fetch via apiFetch.
import type { Metadata } from 'next';
import { AdminAdoptionOverview } from '@/components/custom/forge-telemetry/admin-adoption-overview';
import { AdminTelemetryOverview } from '@/components/custom/forge-telemetry/admin-telemetry-overview';
import { OperatorControlPlane } from '@/components/custom/forge-telemetry/operator-control-plane';
import { requireAdminOnPage } from '@/lib/admin-page-guard';

export const metadata: Metadata = {
  title: 'Admin · Telemetry',
  description:
    'CARI Forge autonomy ladder + per-company credit ledger + chat cost — the platform operating view.',
};

export default async function AdminTelemetryPage() {
  await requireAdminOnPage();
  return (
    <section className="container-page py-section">
      <header className="app-panel p-6">
        <p className="app-caption text-[var(--app-text-muted)]">Admin</p>
        <h1 className="app-h1 mt-1 text-[var(--app-text)]">Telemetry &amp; cost</h1>
        <p className="app-body mt-2 text-[var(--app-text-muted)]">
          Autonomy ladder, credit ledger rollup, and chat spend for every mission on the CARI Forge
          platform. Unknown cost is surfaced honestly — no estimates fabricated.
        </p>
      </header>
      <div className="mt-8 space-y-6">
        <AdminAdoptionOverview />
        <AdminTelemetryOverview />
        <OperatorControlPlane />
      </div>
    </section>
  );
}
