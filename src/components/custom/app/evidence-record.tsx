// @polsia:user-owned — one project's Evidence record (brief, Step 5).
// Three measures at most, then the five questions a buyer or auditor asks,
// each its own collapsed <details> so the page opens quiet. Exports and
// hash verification are retained from the existing assurance pack and
// evidence-trail routes; nothing about those contracts changed.

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { apiHref } from '@/lib/api-href';
import { computeAuditHashChain } from '@/lib/business/forge/assurance-pack';
import { AssurancePack } from '@/lib/contracts/assurance-pack';
import { MissionDetail, type MissionDetailT, MissionList } from '@/lib/contracts/forge';
import { buildEvidenceView, type EvidenceQuestion } from './evidence-view';
import { StatusBadge } from './status-badge';

type RecordState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: MissionDetailT };

type VerifyState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'verified'; count: number }
  | { status: 'mismatch' }
  | { status: 'error'; message: string };

function QuestionDisclosure({ question }: { question: EvidenceQuestion }) {
  return (
    <details className="app-disclosure">
      <summary className="flex min-h-11 flex-col justify-center gap-0.5 py-1">
        <span className="app-body font-medium text-[var(--app-text)]">{question.question}</span>
        <span className="app-small text-[var(--app-text-muted)]">{question.summary}</span>
      </summary>
      <div className="app-detail-body mt-2">
        {question.facts.length === 0 ? (
          <p className="app-small text-[var(--app-text-muted)]">{question.empty}</p>
        ) : (
          <ul className="space-y-3">
            {question.facts.map((fact) => (
              <li key={fact.id} className="app-panel px-3 py-2.5">
                <p className="app-small font-medium text-[var(--app-text)]">{fact.label}</p>
                <p className="app-body mt-0.5 whitespace-pre-wrap text-[var(--app-text)]">
                  {fact.value}
                </p>
                {fact.meta ? (
                  <p className="app-caption mt-1 text-[var(--app-text-muted)]">{fact.meta}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function VerifyHashChain({ missionId }: { missionId: string }) {
  const [state, setState] = React.useState<VerifyState>({ status: 'idle' });

  const verify = async () => {
    if (state.status === 'checking') return; // re-entrancy guard, since the button stays enabled
    setState({ status: 'checking' });
    try {
      // Fetch the mission detail fresh here, rather than reusing the
      // page's own (possibly stale, mounted-earlier) copy: the assurance
      // pack below is always built from the current audit rows, so
      // comparing it against an old audits snapshot would read routine
      // new activity (another decision recorded while this page was
      // open) as a broken chain.
      const [pack, freshDetail] = await Promise.all([
        apiFetch(`/api/forge/missions/${missionId}/assurance-pack`, { schema: AssurancePack }),
        apiFetch(`/api/forge/missions/${missionId}`, { schema: MissionDetail }),
      ]);
      const local = await computeAuditHashChain(freshDetail.audits);
      const byId = new Map(pack.auditTrail.map((e) => [e.id, e]));
      const ok =
        pack.auditTrail.length === local.length &&
        local.every((entry) => {
          const server = byId.get(entry.id);
          return server && server.hash === entry.hash && server.previousHash === entry.previousHash;
        });
      setState(ok ? { status: 'verified', count: local.length } : { status: 'mismatch' });
    } catch (err) {
      setState({
        status: 'error',
        message: apiErrorMessage(err, 'Could not verify the hash chain.'),
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={() => void verify()}
        aria-disabled={state.status === 'checking'}
      >
        {state.status === 'checking' ? 'Verifying…' : 'Verify hash chain'}
      </Button>
      <p className="app-small text-[var(--app-text-muted)]" role="status">
        {state.status === 'verified' &&
          `Verified — ${state.count} recorded ${state.count === 1 ? 'event' : 'events'}, unbroken chain.`}
        {state.status === 'mismatch' &&
          'Could not confirm the chain — recompute did not match the recorded hashes.'}
        {state.status === 'error' && `Could not verify: ${state.message}`}
      </p>
    </div>
  );
}

export function EvidenceRecord({ missionSlug }: { missionSlug: string }) {
  const [state, setState] = React.useState<RecordState>({ status: 'loading' });
  const missionIdRef = React.useRef<string | null>(null);
  // A11y fix: this text lives in a live region that stays mounted for the
  // component's whole life (rendered below, outside the per-state
  // branches) so "loading" and "loaded" both get announced — a live
  // region that only exists inside the conditionally-unmounted loading
  // branch is unlikely to be announced at all, and never announces
  // completion. The error branch keeps its own role="alert", which
  // announces reliably even when mounted fresh.
  const [announcement, setAnnouncement] = React.useState('Loading evidence record');

  const load = React.useCallback(async () => {
    setState({ status: 'loading' });
    setAnnouncement('Loading evidence record');
    try {
      let id = missionIdRef.current;
      if (!id) {
        const list = await apiFetch('/api/forge/missions', { schema: MissionList });
        const found = list.items.find((it) => it.slug === missionSlug);
        if (!found) {
          setState({
            status: 'error',
            message:
              'This project could not be found. It may have been renamed, or you may not have access to it.',
          });
          return;
        }
        id = found.id;
        missionIdRef.current = id;
      }
      const detail = await apiFetch(`/api/forge/missions/${id}`, { schema: MissionDetail });
      setState({ status: 'ready', detail });
      setAnnouncement('Proof record loaded');
    } catch (err) {
      setState({
        status: 'error',
        message: apiErrorMessage(err, 'This evidence record could not be loaded.'),
      });
    }
  }, [missionSlug]);

  React.useEffect(() => {
    missionIdRef.current = null;
    void load();
  }, [load]);

  const liveRegion = (
    <p className="sr-only" aria-live="polite">
      {announcement}
    </p>
  );

  if (state.status === 'loading') {
    return (
      <>
        {liveRegion}
        <div className="app-content space-y-6" aria-busy="true">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-24 w-full rounded-[var(--app-radius)]" />
          <Skeleton className="h-40 w-full rounded-[var(--app-radius)]" />
        </div>
      </>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="app-content">
        <section role="alert" className="app-panel p-5">
          <h1 className="app-h2 text-[var(--app-text)]">
            This evidence record could not be opened
          </h1>
          <p className="app-body mt-1.5 text-[var(--app-text-muted)]">{state.message}</p>
          <Button type="button" className="mt-4 min-h-11" onClick={() => void load()}>
            Try again
          </Button>
        </section>
      </div>
    );
  }

  const { detail } = state;
  const view = buildEvidenceView(detail);

  return (
    <>
      {liveRegion}
      <div className="app-content space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div>
            <p className="app-caption text-[var(--app-text-muted)]">Proof record</p>
            <h1 className="app-h1 mt-0.5 text-[var(--app-text)]">{view.project.name}</h1>
          </div>
          <StatusBadge status={detail.mission.status} />
        </header>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {view.measures.map((m) => (
            <div key={m.label} className="app-panel px-4 py-3">
              <dt className="app-caption text-[var(--app-text-muted)]">{m.label}</dt>
              <dd className="app-h2 mt-1 text-[var(--app-text)]">{m.value}</dd>
              <dd className="app-small mt-1 text-[var(--app-text-muted)]">{m.detail}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2">
          {view.questions.map((q) => (
            <QuestionDisclosure key={q.key} question={q} />
          ))}
        </div>

        <section className="app-panel space-y-3 p-5">
          <p className="app-body font-medium text-[var(--app-text)]">Export this record</p>
          <p className="app-small text-[var(--app-text-muted)]">
            The full decision record behind these questions, and a way to confirm the audit trail
            has not been altered.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            <li>
              <a
                className="app-link app-small"
                href={apiHref(`/api/forge/missions/${detail.mission.id}/export?format=json`)}
              >
                Decision record (JSON)
              </a>
            </li>
            <li>
              <a
                className="app-link app-small"
                href={apiHref(`/api/forge/missions/${detail.mission.id}/export?format=csv`)}
              >
                Decision record (CSV)
              </a>
            </li>
            <li>
              <a
                className="app-link app-small"
                href={apiHref(`/api/forge/missions/${detail.mission.id}/export?format=pdf`)}
              >
                Proof record (PDF)
              </a>
            </li>
          </ul>
          <VerifyHashChain missionId={detail.mission.id} />
        </section>
      </div>
    </>
  );
}
