// @polsia:user-owned — layout for /admin/* inside the (dashboard) route group.
// Pass-through: the page itself gates with requireAdmin() at render time, so
// non-admins never see the table body. We deliberately do NOT nest the
// dashboard-shell layout here — the admin area runs without the in-shell sign
// out / sidebar to keep the leads view focused on the data.

import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
