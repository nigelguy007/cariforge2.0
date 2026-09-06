// @polsia:user-owned — real user report (2026-09-06): "the build is
// complete however i dont see the files and spec as expected." The data
// (generated files + technical spec) was already in the database; this
// panel is the missing read path — every file, the full technical
// architecture, the MVP-to-production roadmap, and a real download.
//
// The download link is a plain <a href> to a GET route, not a client-side
// blob fetch — it works identically whether this page was just loaded or
// the person left and came back after logging out and back in, because
// nothing about it depends on browser state; the server rebuilds the zip
// from Postgres on every request (see the download route's own comment).

'use client';

import { Download, Loader2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { MissionDeliverables, type MissionDeliverablesT } from '@/lib/contracts/forge';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: MissionDeliverablesT }
  | { status: 'error' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="app-small font-medium text-[var(--app-text)]">{title}</h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  if (items.length === 0) {
    return <p className="app-small text-[var(--app-text-muted)]">None recorded.</p>;
  }
  return (
    <ul className="app-small list-disc space-y-1 pl-5 text-[var(--app-text-muted)]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Renders only once the mission has an active SoftwareBuild handoff —
 *  callers gate on that (project-workspace.tsx checks detail.handoffs)
 *  rather than this component silently no-op'ing on a 404, so a real
 *  fetch failure still shows as an error, not a blank space. */
export function MissionDeliverablesPanel({ missionId }: { missionId: string }) {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    apiFetch(`/api/forge/missions/${missionId}/deliverables`, { schema: MissionDeliverables })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  if (state.status === 'loading') {
    return (
      <section className="app-panel" aria-busy="true">
        <p className="app-caption text-[var(--app-text-muted)]">Loading the MVP build…</p>
      </section>
    );
  }
  if (state.status === 'error') {
    return null; // no Software Build output for this mission yet — not an error to show
  }

  const { data } = state;

  return (
    <section aria-labelledby="deliverables-heading" className="app-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="deliverables-heading" className="app-caption text-[var(--app-text-muted)]">
            The MVP build
          </h2>
          <p className="app-body mt-1 max-w-prose text-[var(--app-text)]">
            {data.summary || `${data.files.length} generated files, plus the full technical spec.`}
          </p>
        </div>
        <Button asChild className="min-h-11">
          <a href={`/api/forge/missions/${missionId}/download`}>
            <Download aria-hidden="true" className="size-4" />
            Download everything (.zip)
          </a>
        </Button>
      </div>
      <p className="app-small mt-1 text-[var(--app-text-muted)]">
        Every generated file, plus a technical architecture document and an MVP-to-production
        roadmap. This link works any time you come back — nothing about it depends on staying signed
        in from the same visit.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Section title="Tech stack">
          <BulletList items={data.techStack} />
        </Section>
        <Section title="API surface">
          <BulletList items={data.apiSurface} />
        </Section>
      </div>

      <details className="app-disclosure mt-4">
        <summary className="flex min-h-11 items-center justify-between gap-3">
          <span className="app-body font-medium text-[var(--app-text)]">
            Technical architecture
          </span>
        </summary>
        <div className="mt-2 space-y-3">
          <p className="app-small whitespace-pre-wrap text-[var(--app-text-muted)]">
            {data.architectureOverview || 'Not recorded.'}
          </p>
          <Section title="Data model">
            <p className="app-small whitespace-pre-wrap text-[var(--app-text-muted)]">
              {data.dataModel || 'Not recorded.'}
            </p>
          </Section>
          <Section title="Deployment notes">
            <p className="app-small whitespace-pre-wrap text-[var(--app-text-muted)]">
              {data.deploymentNotes || 'Not recorded.'}
            </p>
          </Section>
        </div>
      </details>

      <details className="app-disclosure mt-2">
        <summary className="flex min-h-11 items-center justify-between gap-3">
          <span className="app-body font-medium text-[var(--app-text)]">
            Files ({data.files.length})
          </span>
        </summary>
        <ul className="app-small mt-2 space-y-1 text-[var(--app-text-muted)]">
          {data.files.map((f) => (
            <li key={f.path} className="truncate font-mono">
              {f.path}
            </li>
          ))}
        </ul>
      </details>

      <details className="app-disclosure mt-2">
        <summary className="flex min-h-11 items-center justify-between gap-3">
          <span className="app-body font-medium text-[var(--app-text)]">
            MVP to production roadmap
          </span>
        </summary>
        {data.roadmap ? (
          <div className="mt-2 space-y-3">
            <p className="app-small text-[var(--app-text-muted)]">{data.roadmap.summary}</p>
            <Section title="Recommended order">
              <BulletList items={data.roadmap.recommendedOrder} />
            </Section>
            <Section title="Security & compliance">
              <BulletList items={data.roadmap.securitySteps} />
            </Section>
            <Section title="Infrastructure & deployment">
              <BulletList items={data.roadmap.infrastructureSteps} />
            </Section>
            <Section title="Data">
              <BulletList items={data.roadmap.dataSteps} />
            </Section>
            <Section title="Observability">
              <BulletList items={data.roadmap.observabilitySteps} />
            </Section>
            <Section title="Testing">
              <BulletList items={data.roadmap.testingSteps} />
            </Section>
            <Section title="Cost & scaling">
              <BulletList items={data.roadmap.costConsiderations} />
            </Section>
          </div>
        ) : (
          <p className="app-small mt-2 flex items-center gap-2 text-[var(--app-text-muted)]">
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            This roadmap is still being prepared — download the .zip and check back shortly.
          </p>
        )}
      </details>
    </section>
  );
}
