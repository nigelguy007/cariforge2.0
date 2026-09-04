// @polsia:user-owned — the single collapsed "Supporting detail" region
// (brief, Step 4 + 7). Closed, it is one row that summarises Council,
// evidence and the decision record. Open, it lists the existing governance
// components one column deep, grouped under plain-language headings. Every
// group is its own native <details> so keyboard, screen readers and
// reduced-motion all work without extra script. Nothing here fetches the
// mission again — the reused components receive the same MissionDetail.

'use client';

import * as React from 'react';
import { MissionAutonomyCard } from '@/components/custom/forge-telemetry/mission-autonomy-card';
import { MissionCostCard } from '@/components/custom/forge-telemetry/mission-cost-card';
import { AssurancePackCard } from '@/components/custom/missions/assurance-pack-card';
import { MissionAuditTimeline } from '@/components/custom/missions/mission-audit-timeline';
import { MissionBlockersPanel } from '@/components/custom/missions/mission-blockers-panel';
import { MissionBuildPanel } from '@/components/custom/missions/mission-build-panel';
import { MissionEvidenceForm } from '@/components/custom/missions/mission-evidence-form';
import { MissionEvidenceList } from '@/components/custom/missions/mission-evidence-list';
import { MissionHandoffCorrectForm } from '@/components/custom/missions/mission-handoff-correct-form';
import { MissionHandoffForm } from '@/components/custom/missions/mission-handoff-form';
import { MissionHandoffTimeline } from '@/components/custom/missions/mission-handoff-timeline';
import { MissionObjectionCard } from '@/components/custom/missions/mission-objection-card';
import { MissionObjectionCreateForm } from '@/components/custom/missions/mission-objection-create-form';
import { MissionPauseResume } from '@/components/custom/missions/mission-pause-resume';
import { MissionReleasePanel } from '@/components/custom/missions/mission-release-panel';
import { MissionReplayForm } from '@/components/custom/missions/mission-replay-form';
import { MissionRollbackForm } from '@/components/custom/missions/mission-rollback-form';
import { MissionToolActionForm } from '@/components/custom/missions/mission-tool-action-form';
import { MissionToolActionsTimeline } from '@/components/custom/missions/mission-tool-actions-timeline';
import { MissionWorkItemsPanel } from '@/components/custom/missions/mission-work-items-panel';
import { OracleAttestationList } from '@/components/custom/missions/oracle-attestation-list';
import { OracleCouncilCard } from '@/components/custom/missions/oracle-council-card';
import { QAReviewCard } from '@/components/custom/missions/qa-review-card';
import type { MissionDetailT } from '@/lib/contracts/forge';
import { DECISION_UI, reasonLabel, STEPS, stageUiForIndex } from '@/lib/ui-terms';
import type { ProjectWorkspaceView } from './use-project-workspace';

export type DetailSection =
  | 'council'
  | 'concerns'
  | 'evidence'
  | 'outputs'
  | 'actions'
  | 'tasks'
  | 'decisions'
  | 'controls'
  | 'record'
  | 'export';

export interface DetailRequest {
  readonly section: DetailSection;
  readonly step?: number;
  /** Bump to re-trigger the same section. */
  readonly tick: number;
}

export interface SupportingDetailProps {
  readonly id: string;
  readonly view: ProjectWorkspaceView;
  readonly detail: MissionDetailT;
  readonly missionSlug: string;
  readonly onWritten: () => Promise<void> | void;
  readonly request: DetailRequest | null;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function summaryLine(view: ProjectWorkspaceView): string {
  const { councilSummary: c, evidenceSummary: e, decisionSummary: d } = view;
  const parts: string[] = [];
  parts.push(
    c.reviewsComplete > 0 ? `${plural(c.reviewsComplete, 'review')} complete` : 'No reviews yet',
  );
  if (c.concernsCarried > 0) parts.push(`${plural(c.concernsCarried, 'concern')} carried forward`);
  else if (c.concernsOpen > 0) parts.push(`${plural(c.concernsOpen, 'concern')} open`);
  parts.push(plural(e.count, 'evidence item'));
  parts.push(`Decision record: ${d.state.toLowerCase()}`);
  return parts.join(' · ');
}

const GROUP_ORDER: readonly { key: DetailSection; title: string }[] = [
  { key: 'council', title: 'Council' },
  { key: 'concerns', title: 'Concerns' },
  { key: 'evidence', title: 'Evidence' },
  { key: 'outputs', title: 'Step outputs' },
  { key: 'actions', title: 'Requested actions' },
  { key: 'tasks', title: 'Tasks' },
  { key: 'decisions', title: 'Decisions by step' },
  { key: 'controls', title: 'Pause, run again or restore' },
  { key: 'record', title: 'Decision record' },
  { key: 'export', title: 'Export and prototype package' },
];

export function SupportingDetail({
  id,
  view,
  detail,
  missionSlug,
  onWritten,
  request,
}: SupportingDetailProps) {
  const [openGroups, setOpenGroups] = React.useState<ReadonlySet<DetailSection>>(() => new Set());
  const [rootOpen, setRootOpen] = React.useState(false);

  // Programmatic open from the next-action card or a completed step.
  React.useEffect(() => {
    if (!request) return;
    setRootOpen(true);
    setOpenGroups((prev) => new Set(prev).add(request.section));
    const target = request.step ? `${id}-step-${request.step}` : `${id}-${request.section}`;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(target);
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      const focusable = el?.querySelector<HTMLElement>('summary, [tabindex], button, a') ?? el;
      focusable?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [request, id]);

  const mission = detail.mission;
  const latestHandoff = view.latestHandoff;
  const awaitingGate = detail.gates.find(
    (g) => g.state === 'Awaiting' && g.gateIndex === mission.currentStageIndex,
  );

  function toggleGroup(key: DetailSection, open: boolean) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  const content: Record<DetailSection, React.ReactNode> = {
    council: (
      <>
        <OracleCouncilCard detail={detail} onWritten={onWritten} />
        {latestHandoff ? (
          <div className="app-panel">
            <p className="app-small text-[var(--app-text-muted)]">
              Specialist reviews on the latest step output (
              {stageUiForIndex(STEPS.findIndex((s) => s.stage === latestHandoff.stage)).title},
              version {latestHandoff.version})
            </p>
            <div className="mt-2">
              <OracleAttestationList
                detail={detail}
                handoff={latestHandoff}
                onWritten={onWritten}
              />
            </div>
          </div>
        ) : null}
        {awaitingGate ? (
          <QAReviewCard missionId={mission.id} gateIndex={awaitingGate.gateIndex} />
        ) : null}
      </>
    ),
    concerns: (
      <>
        {detail.objections.length === 0 ? (
          <p className="app-small text-[var(--app-text-muted)]">No concerns have been raised.</p>
        ) : (
          detail.objections.map((objection) => (
            <MissionObjectionCard
              key={objection.id}
              missionId={mission.id}
              objection={objection}
              onWritten={onWritten}
            />
          ))
        )}
        <MissionObjectionCreateForm detail={detail} onWritten={onWritten} />
      </>
    ),
    evidence: (
      <>
        <MissionEvidenceList detail={detail} />
        <MissionEvidenceForm detail={detail} onWritten={onWritten} />
      </>
    ),
    outputs: (
      <>
        <MissionHandoffTimeline detail={detail} />
        <MissionHandoffForm missionId={mission.id} onWritten={onWritten} />
        <MissionHandoffCorrectForm detail={detail} onWritten={onWritten} />
      </>
    ),
    actions: (
      <>
        <MissionToolActionsTimeline detail={detail} onWritten={onWritten} />
        <MissionToolActionForm detail={detail} onWritten={onWritten} />
      </>
    ),
    tasks: (
      <>
        <MissionWorkItemsPanel missionId={mission.id} />
        <MissionBuildPanel missionId={mission.id} currentStageIndex={mission.currentStageIndex} />
        <MissionReleasePanel missionId={mission.id} />
      </>
    ),
    decisions: (
      <ol className="space-y-3">
        {STEPS.map((step, i) => {
          const gate = detail.gates.find((g) => g.gateIndex === i);
          const approvals = detail.approvals
            .filter((a) => a.gateIndex === i)
            .sort((a, b) => b.at.localeCompare(a.at));
          const latest = approvals[0];
          const isCurrent = i === mission.currentStageIndex;
          return (
            <li
              key={step.stage}
              id={`${id}-step-${step.number}`}
              tabIndex={-1}
              className="app-panel scroll-mt-24"
            >
              <p className="app-body font-medium text-[var(--app-text)]">
                Step {step.number}: {step.title}
              </p>
              {latest ? (
                <p className="app-small mt-1 text-[var(--app-text-muted)]">
                  {DECISION_UI[latest.decision]} by {latest.approverName ?? 'the approver'} on{' '}
                  {new Date(latest.at).toLocaleString()} · {reasonLabel(latest.reasonCode)}
                  {latest.reasonText ? ` — “${latest.reasonText}”` : ''}
                  {latest.controls ? ` · Conditions: ${latest.controls}` : ''}
                </p>
              ) : (
                <p className="app-small mt-1 text-[var(--app-text-muted)]">
                  {gate && isCurrent ? 'Waiting for a decision.' : 'No decision yet.'}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    ),
    controls: (
      <>
        <MissionBlockersPanel missionSlug={missionSlug} />
        <MissionPauseResume detail={detail} onWritten={onWritten} />
        <MissionReplayForm detail={detail} onWritten={onWritten} />
        <MissionRollbackForm detail={detail} onWritten={onWritten} />
      </>
    ),
    record: (
      <>
        <MissionAuditTimeline audits={detail.audits} />
        <MissionAutonomyCard missionSlug={missionSlug} />
        <MissionCostCard missionSlug={missionSlug} />
      </>
    ),
    export: (
      <>
        <div className="app-panel">
          <p className="app-body font-medium text-[var(--app-text)]">
            Approved runnable prototype package
          </p>
          <p className="app-small mt-1 text-[var(--app-text-muted)]">
            The prototype, its Project plan (Blueprint in exports), its Operating guide (Runbook in
            exports) and the evidence receipt. This is a prototype boundary, not a production
            deployment.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <li>
              <a
                className="app-link app-small"
                href={`/api/forge/missions/${mission.id}/blueprint`}
              >
                Project plan (JSON)
              </a>
            </li>
            <li>
              <a className="app-link app-small" href={`/api/forge/missions/${mission.id}/runbook`}>
                Operating guide (JSON)
              </a>
            </li>
            <li>
              <a
                className="app-link app-small"
                href={`/api/forge/missions/${mission.id}/export?format=json`}
              >
                Decision record (JSON)
              </a>
            </li>
            <li>
              <a
                className="app-link app-small"
                href={`/api/forge/missions/${mission.id}/export?format=csv`}
              >
                Decision record (CSV)
              </a>
            </li>
          </ul>
        </div>
        <AssurancePackCard missionId={mission.id} />
      </>
    ),
  };

  return (
    <details
      id={id}
      open={rootOpen}
      onToggle={(e) => setRootOpen(e.currentTarget.open)}
      className="app-disclosure"
    >
      <summary className="flex min-h-11 items-center justify-between gap-3">
        <span className="app-body font-medium text-[var(--app-text)]">Supporting detail</span>
        <span className="app-small text-right text-[var(--app-text-muted)]">
          {summaryLine(view)}
        </span>
      </summary>
      <div className="mt-2 space-y-2">
        {GROUP_ORDER.map((group) => (
          <details
            key={group.key}
            id={`${id}-${group.key}`}
            open={openGroups.has(group.key)}
            onToggle={(e) => toggleGroup(group.key, e.currentTarget.open)}
            className="app-disclosure scroll-mt-24"
          >
            <summary className="app-body min-h-11 text-[var(--app-text)]">{group.title}</summary>
            <div className="app-detail-body mt-2 space-y-3">
              {rootOpen && openGroups.has(group.key) ? content[group.key] : null}
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}
