// @polsia:user-owned — the Evidence index (brief, Step 5). One row per
// project: name, status, the plain-language line for where it stands, and
// an open arrow to /evidence/[slug]. Reads the same /api/forge/missions
// route as the Projects list; nothing about the data changed.

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { MissionList, type MissionListItemT } from '@/lib/contracts/forge';
import { evidenceIndexLine } from './evidence-view';
import { StatusBadge } from './status-badge';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: readonly MissionListItemT[] };

export function EvidenceIndex() {
  const [state, setState] = React.useState<ListState>({ status: 'loading' });
  // A11y fix: a live region nested inside a conditionally-unmounted branch
  // is unreliable — most screen readers only announce a CHANGE to content
  // already in the tree, not content that arrives with its parent. This
  // region stays mounted for the component's whole life; only its text
  // changes, so "loading" and "loaded"/"failed" both get announced.
  const [announcement, setAnnouncement] = React.useState('Loading projects');

  const load = React.useCallback(async () => {
    setState({ status: 'loading' });
    setAnnouncement('Loading projects');
    try {
      const data = await apiFetch('/api/forge/missions', { schema: MissionList });
      const items = [...data.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setState({ status: 'ready', items });
      setAnnouncement(
        items.length === 0
          ? 'No projects yet'
          : `${items.length} ${items.length === 1 ? 'project' : 'projects'} loaded`,
      );
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
      setAnnouncement('Projects could not be loaded');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  let content: React.ReactNode;
  if (state.status === 'loading') {
    content = (
      <div className="app-panel divide-y divide-[var(--app-border)]" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    );
  } else if (state.status === 'error') {
    content = (
      <section role="alert" className="app-panel p-5">
        <h2 className="app-h3 text-[var(--app-text)]">Projects could not be loaded</h2>
        <p className="app-small mt-1 text-[var(--app-text-muted)]">{state.message}</p>
        <Button type="button" className="mt-3 min-h-11" onClick={() => void load()}>
          Try again
        </Button>
      </section>
    );
  } else if (state.items.length === 0) {
    content = (
      <div className="app-panel p-5">
        <p className="app-body text-[var(--app-text-muted)]">
          No projects yet. A project&rsquo;s evidence record appears here once it exists.
        </p>
      </div>
    );
  } else {
    content = (
      <ul className="app-panel divide-y divide-[var(--app-border)]">
        {state.items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/evidence/${item.slug}`}
              className="flex min-h-11 items-center gap-4 px-4 py-3 app-transition hover:bg-[var(--app-surface-muted)]"
            >
              <div className="min-w-0 flex-1">
                <p className="app-body truncate font-medium text-[var(--app-text)]">{item.name}</p>
                <p className="app-small mt-0.5 text-[var(--app-text-muted)]">
                  {evidenceIndexLine(item.currentStageIndex)}
                </p>
              </div>
              <StatusBadge status={item.status} className="shrink-0" />
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-[var(--app-text-muted)]"
              />
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {content}
    </>
  );
}
