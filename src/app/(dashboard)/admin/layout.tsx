// @polsia:user-owned — /admin/* now sits inside the same AppShell as every
// other signed-in route (brief, Step 3: admin lives under the avatar menu,
// not in a separate chrome). Pages still gate themselves with
// requireAdminOnPage() at render time, so non-admins never see the body.

import type { ReactNode } from 'react';
import { AppShell } from '@/components/custom/app/app-shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
