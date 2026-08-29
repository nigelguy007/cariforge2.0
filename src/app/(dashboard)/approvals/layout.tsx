// @polsia:user-owned — /approvals shares the same DashboardShell as
// /dashboard, /missions/* and /forge/*: one signed-in chrome, and the
// client-side redirect to /login for signed-out visitors.

import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/custom/dashboard/dashboard-shell';

export default function ApprovalsLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
