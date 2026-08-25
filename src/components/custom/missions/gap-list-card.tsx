// @polsia:user-owned — Gap list card island.
'use client';

import { FORGE_GAPS } from '@/lib/business/forge/gaps';

export function GapListCard() {
  return (
    <section className="glass-card mt-6 rounded-2xl p-6">
      <h3 className="text-h3">Honest gap list</h3>
      <p className="mt-2 text-small text-muted-foreground">
        These gaps are tracked in the codebase and asserted by{' '}
        <code>tests/unit/forge/gaps.test.ts</code> so they can’t be silently removed by a future
        implementer.
      </p>
      <ul className="mt-4 space-y-3">
        {FORGE_GAPS.map((g) => (
          <li key={g.title} className="rounded-xl border border-border/60 p-3">
            <p className="text-h4">{g.title}</p>
            <p className="mt-1 text-small text-muted-foreground">{g.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
