// @polsia:user-owned — Admin telemetry page (Server Component shell).
// Server-only metadata + admin guard + island composition. No `await prisma`
// in the render layer — the islands fetch via apiFetch.
import type { Metadata } from 'next';
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
      <header className="glass-panel rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Admin</p>
        <h1 className="text-h1 text-foreground">Telemetry &amp; cost</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Autonomy ladder, credit ledger rollup, and chat spend for every mission on the CARI Forge
          platform. Unknown cost is surfaced HONESTLY — no estimates fabricated.
        </p>
      </header>
      <div className="mt-8 space-y-6">
        <AdminTelemetryOverview />
        <OperatorControlPlane />
      </div>
    </section>
  );
}
