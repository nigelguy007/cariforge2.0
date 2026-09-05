// @polsia:user-owned — the single project workspace (brief, Step 4).
//
// One page, one job: show where the project is and the one thing that needs
// the person now. Order is fixed by the brief — small header, five-step
// progress, current-step heading and one sentence, at most three prepared
// facts, one next-action card, one collapsed Supporting detail. No tabs.
// All data comes from useProjectWorkspace once; sections never refetch.

'use client';

import { Building2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { StageName } from '@/lib/contracts/forge';
import { STEPS } from '@/lib/ui-terms';
import { AgentActivityPanel, agentActivityDoneCount } from './agent-activity-panel';
import { NextActionCard } from './next-action-card';
import { PreparedSummary } from './prepared-summary';
import { ProjectStepper } from './project-stepper';
import { StatusBadge } from './status-badge';
import { type DetailRequest, type DetailSection, SupportingDetail } from './supporting-detail';
import { APPROVALS_CHANGED_EVENT } from './use-approvals-count';
import { useProjectWorkspace } from './use-project-workspace';

const DETAIL_ID = 'supporting-detail';

function savedLine(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Saved';
  return `Saved ${date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

/** Skeleton that matches the ready layout so nothing jumps when data lands. */
function WorkspaceSkeleton() {
  return (
    <div className="app-content space-y-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading project</p>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
      <Skeleton className="h-32 w-full rounded-[var(--app-radius)]" />
      <Skeleton className="h-40 w-full rounded-[var(--app-radius)]" />
      <Skeleton className="h-12 w-full rounded-[var(--app-radius)]" />
    </div>
  );
}

export function ProjectWorkspace({ missionSlug }: { missionSlug: string }) {
  const { state, refresh } = useProjectWorkspace(missionSlug);
  const [request, setRequest] = React.useState<DetailRequest | null>(null);
  // Real user report (2026-09-05): the Agent activity list had no live
  // signal while a Draft with AI click was actually running — see
  // next-action-card.tsx's draftWithAi and agent-activity-panel.tsx's
  // draftingStage prop. Lifted here since it's the shared parent of both.
  const [draftingStage, setDraftingStage] = React.useState<StageName | null>(null);
  const agentActivityRef = React.useRef<HTMLDetailsElement>(null);
  // Force the (collapsed-by-default) section open the moment drafting
  // starts, so "Working…" is visible without the user having to already
  // know to expand it — but only on that one rising edge. Setting `open`
  // as a controlled JSX prop instead would fight the user's own manual
  // toggle on every unrelated re-render (this section re-renders often,
  // e.g. on every onWritten() refresh), silently snapping it shut again;
  // an imperative one-shot set on the DOM node avoids that entirely.
  React.useEffect(() => {
    if (draftingStage !== null && agentActivityRef.current) {
      agentActivityRef.current.open = true;
    }
  }, [draftingStage]);

  const openSection = React.useCallback((section: DetailSection, step?: number) => {
    setRequest((prev) => ({ section, step, tick: (prev?.tick ?? 0) + 1 }));
  }, []);

  // A recorded decision changes what needs the person: refetch this view and
  // let the Approvals badge in the nav refetch its count too.
  const onWritten = React.useCallback(() => {
    window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
    return refresh();
  }, [refresh]);

  if (state.status === 'loading') return <WorkspaceSkeleton />;

  if (state.status === 'error') {
    return (
      <div className="app-content">
        <nav aria-label="Breadcrumb" className="app-small text-[var(--app-text-muted)]">
          <Link href="/missions" className="app-link">
            All projects
          </Link>
        </nav>
        <section role="alert" className="app-panel mt-4 p-5">
          <h1 className="app-h2 text-[var(--app-text)]">This project could not be opened</h1>
          <p className="app-body mt-1.5 text-[var(--app-text-muted)]">{state.message}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" className="min-h-11" onClick={() => void refresh()}>
              Try again
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/missions">Back to projects</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const { view, detail } = state;
  const step = view.currentStep;

  return (
    <div className="app-content space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="app-small text-[var(--app-text-muted)]">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/missions" className="app-link">
                  All projects
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="truncate text-[var(--app-text)]" aria-current="page">
                {view.project.name}
              </li>
            </ol>
          </nav>
          <p className="app-caption mt-1 text-[var(--app-text-muted)]">{savedLine(view.savedAt)}</p>
        </div>
        <StatusBadge status={view.project.status} />
      </header>

      <ProjectStepper
        currentStep={step.number}
        completedSteps={view.completedSteps}
        revisitTargetId={DETAIL_ID}
        onRevisit={(n) => openSection('decisions', n)}
        approvals={detail.approvals}
      />

      <div>
        <p className="app-caption text-[var(--app-text-muted)]">Step {step.number} of 5</p>
        <h1 className="app-h1 mt-0.5 text-[var(--app-text)]">{step.title}</h1>
        <p className="app-body mt-1.5 max-w-prose text-[var(--app-text-muted)]">{step.sentence}</p>
      </div>

      <PreparedSummary items={view.summaryItems} />

      <NextActionCard
        view={view}
        detail={detail}
        onWritten={onWritten}
        onOpenSection={openSection}
        detailId={DETAIL_ID}
        onDraftingStageChange={setDraftingStage}
      />

      <div className="flex justify-end">
        {/* .app-glass-cta (custom-style.css): a deliberate, scoped liquid-
            glass treatment for this one CTA — real user request
            (2026-09-05), "make the office view a liquid glass button" —
            not a reversal of the rest of the signed-in app's flat "small
            and clean" chrome. */}
        <Link href={`/missions/${missionSlug}/office`} className="app-glass-cta">
          <Building2 className="size-4" aria-hidden="true" />
          Open Office view
        </Link>
      </div>

      <details ref={agentActivityRef} className="app-disclosure">
        <summary className="flex min-h-11 items-center justify-between gap-3">
          <span className="app-body font-medium text-[var(--app-text)]">Agent activity</span>
          <span className="app-small text-right text-[var(--app-text-muted)]">
            {draftingStage !== null
              ? 'Working…'
              : `${agentActivityDoneCount(detail)} of ${STEPS.length} complete`}
          </span>
        </summary>
        <div className="mt-2">
          <AgentActivityPanel detail={detail} draftingStage={draftingStage} />
        </div>
      </details>

      <SupportingDetail
        id={DETAIL_ID}
        view={view}
        detail={detail}
        missionSlug={missionSlug}
        onWritten={onWritten}
        request={request}
      />
    </div>
  );
}
