// @polsia:user-owned — the single collapsed "Supporting detail" region
// (brief, Step 4 + 7). Closed, it is one row that summarises concerns,
// evidence and the decision record. Open, it lists only what a submitter
// (or, for admin-only groups, an admin) has something to do or read about:
// raise/view concerns, attach evidence, sign off as a specialist, decide a
// pending requested action, review the per-step decision history, and
// export the prototype. Purely internal/ops tooling (raw step-output
// forms, work-item tracking, replay/rollback, audit-trail telemetry) is
// admin-only or gone from this page entirely — that record lives, already
// translated, on the Evidence page (real finding, 2026-09-04 user review:
// several of these groups showed raw internal jargon, an admin mutation
// form, or pure telemetry to every signed-in user regardless of role).
// Every remaining group is its own native <details> so keyboard, screen
// readers and reduced-motion all work without extra script. Nothing here
// fetches the mission again — the reused components receive the same
// MissionDetail.

'use client';

import Link from 'next/link';
import * as React from 'react';
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
import { useIsAdmin } from '@/lib/auth-client';
import { isStaleHandoff } from '@/lib/business/forge/handoffs';
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

// Real user report (2026-09-05, live screenshots): "it says there are 3
// outstanding concerns unresolved .. yet the system says they are
// resolved" — the Concerns list rendered every objection ever raised on
// this mission, across every past draft version of every step, as one
// flat chronological pile with no separation between "still needs your
// answer" and "from a draft that's since been redrafted away." On a
// mission redrafted several times that reads as a wall of contradictory-
// looking statuses even when every individual one is accurate. Split by
// whether the objection's own handoff is still the live one for its
// stage — not superseded AND not invalidated (a downstream stage after a
// redraft/replay/rollback is left with supersededById: null but a real
// invalidationReasonCode; its own concerns are exactly as stale as a
// superseded handoff's, just on a different stage — see
// carryForwardStaleObjections's call sites in service.ts). The historical
// group should mostly show settled, "carried forward" concerns now that
// all four of those write paths carry them forward, not open ones.
export function partitionObjections(detail: MissionDetailT) {
  const staleHandoffIds = new Set(detail.handoffs.filter(isStaleHandoff).map((h) => h.id));
  const current: typeof detail.objections = [];
  const historical: typeof detail.objections = [];
  for (const o of detail.objections) {
    (staleHandoffIds.has(o.stageHandoffId) ? historical : current).push(o);
  }
  return { current, historical };
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
  { key: 'council', title: 'Council review' },
  { key: 'concerns', title: 'Concerns' },
  { key: 'evidence', title: 'Evidence' },
  { key: 'outputs', title: 'Step outputs' },
  { key: 'actions', title: 'Requested actions' },
  { key: 'tasks', title: 'Tasks' },
  { key: 'decisions', title: 'Decisions by step' },
  { key: 'controls', title: 'Pause, run again or restore' },
  { key: 'export', title: 'Export and solution package' },
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
  const isAdmin = useIsAdmin();

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
  // Real bug fix (2026-09-05): both of these used to match on
  // mission.currentStageIndex, which the same live incident showed
  // advances the moment a handoff is SUBMITTED — before its gate is
  // actually decided (see use-project-workspace.ts's currentGate and the
  // /draft route for the full writeup). Advisory-only here (QAReviewCard
  // never gates anything, and atBuildGate only controls section
  // visibility), so the impact was smaller than the write-path bug fixed
  // there, but the same fix applies: use view.currentGate, already
  // corrected to the real pending gate.
  const awaitingGate = view.currentGate;
  const atBuildGate = view.currentGate?.gateIndex === 4;
  const hasPendingToolAction = detail.toolActions.some((t) => t.decision === null);

  // Real finding (2026-09-04 user review): several groups here only ever
  // held internal ops/testing tooling for a non-admin viewer, or a form
  // that was already admin-gated with nothing left to show — an empty,
  // pointless heading is still clutter. Groups render only when there is
  // something in them for the person actually looking: an admin, or a
  // genuine pending decision / step that has been reached.
  const visibleGroups = GROUP_ORDER.filter((group) => {
    if (group.key === 'outputs') return isAdmin;
    if (group.key === 'actions') return isAdmin || hasPendingToolAction;
    if (group.key === 'tasks') return isAdmin || atBuildGate;
    return true;
  });

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
        {isAdmin ? <OracleCouncilCard detail={detail} onWritten={onWritten} /> : null}
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
          (() => {
            const { current, historical } = partitionObjections(detail);
            return (
              <>
                {current.length === 0 ? (
                  <p className="app-small text-[var(--app-text-muted)]">
                    No concerns on the current step output.
                  </p>
                ) : (
                  current.map((objection) => (
                    <MissionObjectionCard
                      key={objection.id}
                      missionId={mission.id}
                      objection={objection}
                      onWritten={onWritten}
                    />
                  ))
                )}
                {historical.length > 0 ? (
                  <details className="app-disclosure">
                    <summary className="app-small text-[var(--app-text-muted)]">
                      From earlier drafts ({historical.length}) — no longer the live step output
                    </summary>
                    <div className="mt-3 space-y-3">
                      {historical.map((objection) => (
                        <MissionObjectionCard
                          key={objection.id}
                          missionId={mission.id}
                          objection={objection}
                          onWritten={onWritten}
                        />
                      ))}
                    </div>
                  </details>
                ) : null}
              </>
            );
          })()
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
        {isAdmin ? (
          <>
            <MissionHandoffForm missionId={mission.id} onWritten={onWritten} />
            <MissionHandoffCorrectForm detail={detail} onWritten={onWritten} />
          </>
        ) : null}
      </>
    ),
    actions: (
      <>
        <MissionToolActionsTimeline detail={detail} onWritten={onWritten} />
        {isAdmin ? <MissionToolActionForm detail={detail} onWritten={onWritten} /> : null}
      </>
    ),
    tasks: (
      <>
        {isAdmin ? <MissionWorkItemsPanel missionId={mission.id} /> : null}
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
        {isAdmin ? (
          <>
            <MissionReplayForm detail={detail} onWritten={onWritten} />
            <MissionRollbackForm detail={detail} onWritten={onWritten} />
          </>
        ) : null}
      </>
    ),
    export: (
      <div className="app-panel">
        <p className="app-body font-medium text-[var(--app-text)]">
          Approved, finished, ready-to-use solution package
        </p>
        <p className="app-small mt-1 text-[var(--app-text-muted)]">
          The finished solution, its Project plan and its Operating guide — not a production
          deployment. The full decision record — why this exists, who approved each step, what
          changed — is on the Proof page for this project.
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <li>
            <Link href={`/evidence/${missionSlug}`} className="app-link app-small">
              Open the full proof record
            </Link>
          </li>
          <li>
            <a className="app-link app-small" href={`/api/forge/missions/${mission.id}/blueprint`}>
              Project plan (JSON)
            </a>
          </li>
          <li>
            <a className="app-link app-small" href={`/api/forge/missions/${mission.id}/runbook`}>
              Operating guide (JSON)
            </a>
          </li>
        </ul>
      </div>
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
        {visibleGroups.map((group) => (
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
