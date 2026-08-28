// @polsia:user-owned — wraps every /forge/* page in the same DashboardShell
// as /dashboard: one signed-in chrome (handover §7 / R2 "one consistent
// shell"), and — per security review — the client-side redirect to /login
// for signed-out visitors. Data was never exposed (every /api/forge-canvas
// route 401s without a session); this closes the page-shell gap too.

import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/custom/dashboard/dashboard-shell';

export default function ForgeLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
