// @polsia:user-owned — R2 (mission pipeline rebuild): every /missions route now
// shares the exact same DashboardShell as /dashboard — one nav, one identity
// display, one logout, matching the reference platform's single CasesLayout
// pattern instead of two disconnected page templates. /admin deliberately
// keeps its own bare layout (see (dashboard)/admin/layout.tsx) — unaffected.

import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/custom/dashboard/dashboard-shell';

export default function MissionsLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
