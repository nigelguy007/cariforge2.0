// @polsia:user-owned — the compact Projects list (brief, Step 5). One row
// per project: name, plain-language step, one status badge, last update and
// a single open arrow. No cards, no tag chips, no confidence percentages —
// those live inside the project. Reads the same /api/forge/missions route
// as the old card list; nothing about the data changed.

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { MissionList, type MissionListItemT } from '@/lib/contracts/forge';
import { stageUiForIndex } from '@/lib/ui-terms';
import { StatusBadge } from './status-badge';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: readonly MissionListItemT[] };

function updatedLine(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ProjectList({ showEmptyCta = true }: { showEmptyCta?: boolean } = {}) {
  const [state, setState] = React.useState<ListState>({ status: 'loading' });

  const load = React.useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const data = await apiFetch('/api/forge/missions', { schema: MissionList });
      const items = [...data.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setState({ status: 'ready', items });
    } catch (err) {
      setState({ status: 'error', message: apiErrorMessage(err, 'Projects could not be loaded.') });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div
        className="app-panel divide-y divide-[var(--app-border)]"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="sr-only">Loading projects</p>
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
  }

  if (state.status === 'error') {
    return (
      <section role="alert" className="app-panel p-5">
        <h2 className="app-h3 text-[var(--app-text)]">Projects could not be loaded</h2>
        <p className="app-small mt-1 text-[var(--app-text-muted)]">{state.message}</p>
        <Button type="button" className="mt-3 min-h-11" onClick={() => void load()}>
          Try again
        </Button>
      </section>
    );
  }

  if (state.items.length === 0) {
    return (
      <section className="app-panel p-6">
        <h2 className="app-h3 text-[var(--app-text)]">No projects yet</h2>
        <p className="app-body mt-1 max-w-prose text-[var(--app-text-muted)]">
          Describe what the business needs in plain language. CariForge prepares each step and you
          approve it before the next one starts.
        </p>
        {showEmptyCta ? (
          <Button asChild className="mt-4 min-h-11">
            <Link href="/missions/new">Start a project</Link>
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <ul className="app-panel divide-y divide-[var(--app-border)]">
      {state.items.map((m) => {
        const step = stageUiForIndex(m.currentStageIndex);
        return (
          <li key={m.id}>
            <Link
              href={`/missions/${m.slug}`}
              className="app-transition flex min-h-14 items-center gap-4 px-4 py-3 hover:bg-[var(--app-accent-soft)] focus-visible:bg-[var(--app-accent-soft)]"
            >
              <div className="min-w-0 flex-1">
                <p className="app-body truncate font-medium text-[var(--app-text)]">{m.name}</p>
                <p className="app-small mt-0.5 text-[var(--app-text-muted)]">
                  Step {step.number} · {step.title}
                  {m.updatedAt ? ` · Updated ${updatedLine(m.updatedAt)}` : ''}
                </p>
              </div>
              <StatusBadge status={m.status} className="shrink-0" />
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-[var(--app-text-muted)]"
              />
              <span className="sr-only">Open {m.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
