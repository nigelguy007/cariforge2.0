// @polsia:user-owned — Admin mission dashboard: a Server Component gating
// with requireAdminOnPage and rendering a 'use client' island.

import type { Metadata } from 'next';
import { OperatorControlPlane } from '@/components/custom/forge-telemetry/operator-control-plane';
import { AdminMissionList } from '@/components/custom/missions/admin-mission-list';
import { requireAdminOnPage } from '@/lib/admin-page-guard';

export const metadata: Metadata = {
  title: 'Admin · Missions',
  description: 'Admin-only view of every CARI Forge mission.',
};

export default async function AdminMissionsPage() {
  await requireAdminOnPage();
  return (
    <section className="container-page py-section">
      <header className="glass-panel rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Admin</p>
        <h1 className="text-h1 text-foreground">All missions</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Every mission recorded by the CARI Forge control plane.
        </p>
      </header>
      <div className="glass-card mt-8 rounded-2xl p-6">
        <AdminMissionList />
      </div>
      <div className="mt-8">
        <OperatorControlPlane />
      </div>
    </section>
  );
}
