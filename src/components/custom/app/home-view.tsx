// @polsia:user-owned — Home (nav restructure, 2026-09-05, Kore.ai-Artemis
// comparison brief): the new default landing page after sign-in. A goal
// input hands straight off to the existing chat intake flow (?intake= into
// /missions/new, unchanged); a compact list shows the 3-5 most recently
// updated projects with the four-state badge (see displayStateFor in
// ui-terms.ts); a Needs-you section reuses useApprovalsCount/approvalsHeading
// and renders only when something actually needs the signed-in person.
// Deliberately no vanity metrics, no large feature cards — everything full
// detail still lives on /missions ("Projects") and /approvals.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { MissionList, type MissionListItemT } from '@/lib/contracts/forge';
import { DISPLAY_STATE_TONE, DISPLAY_STATE_UI, displayStateFor, stageUiForIndex } from '@/lib/ui-terms';
import { cn } from '@/lib/utils';
import { approvalsHeading } from './approvals-queue';
import { TONE_CLASS, TONE_ICON } from './status-badge';
import { useApprovalsCount } from './use-approvals-count';

const RECENT_COUNT = 5;

function updatedLine(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function DisplayStateBadge({ status }: { status: MissionListItemT['status'] }) {
  const state = displayStateFor(status);
  const tone = DISPLAY_STATE_TONE[state];
  const Icon = TONE_ICON[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-[var(--app-radius-sm)] border px-2 py-0.5 text-[length:var(--app-caption)] font-medium leading-5',
        TONE_CLASS[tone],
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {DISPLAY_STATE_UI[state]}
    </span>
  );
}

function GoalInput() {
  const router = useRouter();
  const [text, setText] = React.useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    // Same ?intake= handoff /missions/new already reads into
    // MissionIntakeChat's initialIntake prop — nothing new to wire up.
    router.push(trimmed ? `/missions/new?intake=${encodeURIComponent(trimmed)}` : '/missions/new');
  };

  return (
    <form onSubmit={onSubmit} className="app-panel space-y-3 p-5 sm:p-6">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Describe the business problem you want CariForge to solve…"
        className="resize-none"
        aria-label="What do you want to get done?"
      />
      <Button type="submit" className="min-h-11">
        Start a project
      </Button>
    </form>
  );
}

function NeedsYou() {
  const approvals = useApprovalsCount();
  // Per spec: this section doesn't render at all unless something genuinely
  // needs the person — not even a "nothing needs you" placeholder.
  if (!approvals.loaded || approvals.total === 0) return null;
  return (
    <section aria-labelledby="needs-you-heading" className="app-panel-action space-y-2 p-5 sm:p-6">
      <p className="app-caption text-[var(--app-text-muted)]">Needs you</p>
      <h2 id="needs-you-heading" className="app-h2 text-[var(--app-text)]">
        {approvalsHeading(approvals.total)}
      </h2>
      <p className="app-body max-w-prose text-[var(--app-text-muted)]">
        Every decision is recorded with your name and a note.
      </p>
      <Button asChild className="mt-2 min-h-11">
        <Link href="/approvals">Review approvals</Link>
      </Button>
    </section>
  );
}

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: readonly MissionListItemT[] };

function RecentProjects() {
  const [state, setState] = React.useState<ListState>({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    apiFetch('/api/forge/missions', { schema: MissionList })
      .then((data) => {
        if (cancelled) return;
        const items = [...data.items]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, RECENT_COUNT);
        setState({ status: 'ready', items });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: 'error', message: apiErrorMessage(err, 'Projects could not be loaded.') });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="recent-projects-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-projects-heading" className="app-h2 text-[var(--app-text)]">
          Recent projects
        </h2>
        <Link href="/missions" className="app-link app-small">
          See all projects
        </Link>
      </div>

      {state.status === 'loading' ? (
        <div className="app-panel divide-y divide-[var(--app-border)]" aria-busy="true">
          <p className="sr-only">Loading projects</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="app-panel p-5">
          <p className="app-small text-[var(--app-text-muted)]">{state.message}</p>
        </div>
      ) : null}

      {state.status === 'ready' && state.items.length === 0 ? (
        <div className="app-panel p-6">
          <p className="app-body text-[var(--app-text-muted)]">
            No projects yet — describe what you want to get done above to start your first one.
          </p>
        </div>
      ) : null}

      {state.status === 'ready' && state.items.length > 0 ? (
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
                      {step.title}
                      {m.updatedAt ? ` · Updated ${updatedLine(m.updatedAt)}` : ''}
                    </p>
                  </div>
                  <DisplayStateBadge status={m.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export function HomeView() {
  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="app-h1 text-[var(--app-text)]">What do you want to get done?</h1>
        <p className="app-body max-w-prose text-[var(--app-text-muted)]">
          Describe a business need in plain language. CariForge drafts, reviews and advances each
          step on its own, bringing you in only when a step needs your judgment.
        </p>
      </header>
      <GoalInput />
      <NeedsYou />
      <RecentProjects />
    </div>
  );
}
