// @polsia:user-owned — page-level admin guard. biome's noRestrictedImports
// disallows importing @/lib/auth + next/headers from a `page.tsx` (the
// exemptions cover /api route handlers + src/lib, but not page files), so
// we expose the same guard here, in src/lib, where the page can import it
// freely. Same redirect semantics as src/lib/require-admin: /login when
// unauthenticated, / when signed in but not admin.

import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export async function requireAdminOnPage(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/');
}
