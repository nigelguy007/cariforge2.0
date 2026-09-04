// @polsia:user-owned — every signed-in route shares the one AppShell
// (brief, Step 3 + 7): Projects / Approvals / Evidence nav, avatar menu, and
// the client-side redirect to /login for signed-out visitors.

import type { ReactNode } from 'react';
import { AppShell } from '@/components/custom/app/app-shell';

export default function AppRouteLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
