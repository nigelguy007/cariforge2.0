// @polsia:user-owned — /forge/approvals used to be a second, run-only
// approval inbox. UX review C3 (wireframe v2): one approver, one queue —
// gate decisions and run pauses are the same primitive, so this route now
// permanently redirects to the unified /approvals inbox. Old bookmarks
// and in-app links keep working.

import { redirect } from 'next/navigation';

export default function ApprovalDeskRedirect() {
  redirect('/approvals');
}
