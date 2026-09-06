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
      <header className="app-panel p-6">
        <p className="app-caption text-[var(--app-text-muted)]">Admin</p>
        <h1 className="app-h1 mt-1 text-[var(--app-text)]">All missions</h1>
        <p className="app-body mt-2 text-[var(--app-text-muted)]">
          Every mission recorded by the CARI Forge control plane.
        </p>
      </header>
      <div className="app-panel mt-8 p-6">
        <AdminMissionList />
      </div>
      <div className="mt-8">
        <OperatorControlPlane />
      </div>
    </section>
  );
}
