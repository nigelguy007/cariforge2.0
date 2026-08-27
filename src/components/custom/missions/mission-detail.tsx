// @polsia:user-owned — Mission detail client island. Tabs surface the
// entire forge control plane: overview / handoffs / gates / objections /
// evidence / tool actions / audit / export. Pulls from /api/forge/missions/[id].

'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api-client';
import {
  GATE_DEFS,
  type GateStateT,
  MissionDetail as MissionDetailSchema,
  type MissionDetailT,
} from '@/lib/contracts/forge';
import { AssurancePackCard } from './assurance-pack-card';
import { GapListCard } from './gap-list-card';
import { MissionAuditTimeline } from './mission-audit-timeline';
import { MissionBlockersPanel } from './mission-blockers-panel';
import { MissionEvidenceForm } from './mission-evidence-form';
import { MissionEvidenceList } from './mission-evidence-list';
import { MissionGatePanel } from './mission-gate-panel';
import { MissionHandoffCorrectForm } from './mission-handoff-correct-form';
import { MissionHandoffForm } from './mission-handoff-form';
import { MissionHandoffTimeline } from './mission-handoff-timeline';
import { MissionNextActionPanel } from './mission-next-action-panel';
import { MissionObjectionCard } from './mission-objection-card';
import { MissionObjectionCreateForm } from './mission-objection-create-form';
import { MissionPauseResume } from './mission-pause-resume';
import { MissionReleasePanel } from './mission-release-panel';
import { MissionReplayForm } from './mission-replay-form';
import { MissionRollbackForm } from './mission-rollback-form';
import { MissionStatusBadge } from './mission-status-badge';
import { MissionToolActionForm } from './mission-tool-action-form';
import { MissionToolActionsTimeline } from './mission-tool-actions-timeline';
import { MissionWorkItemsPanel } from './mission-work-items-panel';
import { OracleAttestationList } from './oracle-attestation-list';
import { OracleCouncilCard } from './oracle-council-card';
import { QAReviewCard } from './qa-review-card';

export function MissionDetail({ missionSlug }: { missionSlug: string }) {
  const [detail, setDetail] = React.useState<MissionDetailT | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const listData = await apiFetch('/api/forge/missions', {
          schema: (await import('@/lib/contracts/forge')).MissionList,
        });
        const found = listData.items.find((it) => it.slug === missionSlug);
        if (!found) {
          if (!cancelled) setError('Mission not found');
          return;
        }
        const detail = await apiFetch(`/api/forge/missions/${found.id}`, {
          schema: MissionDetailSchema,
        });
        if (!cancelled) setDetail(detail);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionSlug]);

  const handleWritten = React.useCallback(async () => {
    setDetail(null);
    try {
      const listData = await apiFetch('/api/forge/missions', {
        schema: (await import('@/lib/contracts/forge')).MissionList,
      });
      const found = listData.items.find((it) => it.slug === missionSlug);
      if (!found) return;
      const detail = await apiFetch(`/api/forge/missions/${found.id}`, {
        schema: MissionDetailSchema,
      });
      setDetail(detail);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [missionSlug]);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-foreground">Could not load mission: {error}</p>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-muted-foreground">Loading mission…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MissionNextActionPanel missionId={detail.mission.id} />
      <MissionBlockersPanel missionSlug={missionSlug} />
      <OracleCouncilCard detail={detail} onWritten={handleWritten} />
      <MissionReleasePanel missionId={detail.mission.id} />
      <MissionWorkItemsPanel missionId={detail.mission.id} />
      <header className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 text-foreground">{detail.mission.name}</h1>
            <p className="mt-1 text-small text-muted-foreground">
              Mission ID: <code className="text-caption">{detail.mission.id}</code>
            </p>
          </div>
          <MissionStatusBadge status={detail.mission.status} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-body md:grid-cols-4">
          <div>
            <dt className="text-caption text-muted-foreground">Current stage</dt>
            <dd className="text-h4">{stageLabelForIndex(detail.mission.currentStageIndex)}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Confidence</dt>
            <dd className="text-h4">{Math.round(detail.mission.confidence * 100)}%</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Handoffs</dt>
            <dd className="text-h4">{detail.handoffs.length}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Decisions</dt>
            <dd className="text-h4">{detail.approvals.length}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <MissionPauseResume detail={detail} onWritten={handleWritten} />
          <MissionReplayForm detail={detail} onWritten={handleWritten} />
          <MissionRollbackForm detail={detail} onWritten={handleWritten} />
        </div>
      </header>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="glass-chip flex flex-wrap gap-1 rounded-full p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="handoffs">Handoffs</TabsTrigger>
          <TabsTrigger value="gates">Gates</TabsTrigger>
          <TabsTrigger value="objections">Objections</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="tool-actions">Tool actions</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <section className="glass-card rounded-2xl p-6">
              <h2 className="text-h3">Intake</h2>
              <p className="mt-2 whitespace-pre-wrap text-body">{detail.mission.intake}</p>
            </section>
            <section className="glass-card rounded-2xl p-6">
              <h2 className="text-h3">Last audit events</h2>
              <ul className="mt-2 space-y-2 text-body">
                {detail.audits.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <span className="text-caption text-muted-foreground">
                      {new Date(a.at).toLocaleString()} —{' '}
                    </span>
                    <span className="text-foreground">{a.event}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="glass-card rounded-2xl p-6 md:col-span-2">
              <h2 className="text-h3">Gate panel</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-5">
                {detail.gates.map((g) => (
                  <GateCard key={g.gateIndex} gate={g} />
                ))}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="handoffs">
          <div className="space-y-6">
            <MissionHandoffForm missionId={detail.mission.id} onWritten={handleWritten} />
            <MissionHandoffTimeline detail={detail} />
            <LatestHandoffAttesters detail={detail} onWritten={handleWritten} />
            <MissionHandoffCorrectForm detail={detail} onWritten={handleWritten} />
          </div>
        </TabsContent>

        <TabsContent value="gates">
          <div className="space-y-4">
            {detail.gates.map((g) => (
              <div key={g.gateIndex} className="space-y-3">
                {/* R7: QA review only makes sense ahead of a decision still
                    to be made. `g.state === 'Awaiting'` isn't enough on its
                    own — every gate the mission hasn't reached yet also
                    defaults to 'Awaiting' (no approval row exists for it
                    yet), so that check alone fired a QA-review request, and
                    an alarming "couldn't run" notice, under gates with no
                    artefact at all. Only the mission's actual current gate
                    has a real handoff for the reviewer to look at. */}
                {g.state === 'Awaiting' && g.gateIndex === detail.mission.currentStageIndex && (
                  <QAReviewCard missionId={detail.mission.id} gateIndex={g.gateIndex} />
                )}
                <MissionGatePanel
                  missionId={detail.mission.id}
                  gateState={g}
                  onWritten={handleWritten}
                />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="objections">
          <div className="space-y-4">
            <MissionObjectionCreateForm detail={detail} onWritten={handleWritten} />
            {detail.objections.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-body text-muted-foreground">
                No objections recorded yet.
              </div>
            ) : (
              detail.objections.map((o) => (
                <MissionObjectionCard
                  key={o.id}
                  missionId={detail.mission.id}
                  objection={o}
                  onWritten={handleWritten}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="evidence">
          <div className="space-y-4">
            <MissionEvidenceForm detail={detail} onWritten={handleWritten} />
            <MissionEvidenceList detail={detail} />
          </div>
        </TabsContent>

        <TabsContent value="tool-actions">
          <div className="space-y-4">
            <MissionToolActionForm detail={detail} onWritten={handleWritten} />
            <MissionToolActionsTimeline detail={detail} onWritten={handleWritten} />
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <MissionAuditTimeline audits={detail.audits} />
        </TabsContent>

        <TabsContent value="export">
          <section className="glass-card space-y-4 rounded-2xl p-6">
            <h2 className="text-h3">Evidence trail export</h2>
            <p className="text-body text-muted-foreground">
              Download a JSON envelope or a CSV listing every handoff, approval, objection, evidence
              item, tool action, and audit event with their attribution.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                className="glass-cta inline-flex items-center rounded-full px-4 py-2 text-body"
                href={`/api/forge/missions/${detail.mission.id}/export?format=json`}
                target="_blank"
                rel="noreferrer"
              >
                Download JSON
              </a>
              <a
                className="glass-outline-cta inline-flex items-center rounded-full px-4 py-2 text-body"
                href={`/api/forge/missions/${detail.mission.id}/export?format=csv`}
                target="_blank"
                rel="noreferrer"
              >
                Download CSV
              </a>
            </div>
            <AssurancePackCard missionId={detail.mission.id} />
            <GapListCard />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// R5 (mission pipeline rebuild): read the "current stage" label from
// GATE_DEFS instead of a hand-duplicated array — the array previously said
// 'SoftwareBuild' here regardless of what GATE_DEFS itself called the gate,
// so the two could silently drift. Single source of truth now.
function stageLabelForIndex(idx: number): string {
  return GATE_DEFS[Math.min(idx, GATE_DEFS.length - 1)]?.name ?? 'Draft';
}

function GateCard({ gate }: { gate: GateStateT }) {
  const tone =
    gate.state === 'Approved'
      ? 'bg-emerald-500/15 text-emerald-800'
      : gate.state === 'Refused'
        ? 'bg-rose-500/15 text-rose-800'
        : gate.state === 'Returned'
          ? 'bg-amber-500/15 text-amber-800'
          : 'glass-chip';
  // R5: show the gate's actual title (GATE_DEFS[i].name — e.g. "Prototype
  // spec approved") rather than the raw internal stage identifier. This was
  // previously rendering gate.stage verbatim for all 5 cards, which is how
  // "SoftwareBuild" ended up on-screen with no honest gate-5 label at all.
  const def = GATE_DEFS[gate.gateIndex];
  return (
    <div className={`rounded-2xl p-4 ${tone}`}>
      <p className="text-caption uppercase tracking-wide">Gate {gate.gateIndex}</p>
      <p className="text-h4">{def?.name ?? gate.stage}</p>
      <p className="mt-1 text-small">State: {gate.state}</p>
    </div>
  );
}

// LatestHandoffAttesters — surface the attester panel on the most recent
// non-superseded handoff. The Oracle decides the gate for that handoff, so
// this is where the typed "specialist voice" needs to be collected.
function LatestHandoffAttesters({
  detail,
  onWritten,
}: {
  detail: MissionDetailT;
  onWritten: () => Promise<void> | void;
}) {
  const latest = detail.handoffs.find((h) => !h.supersededById) ?? detail.handoffs[0] ?? null;
  if (!latest) return null;
  return (
    <section className="glass-card space-y-3 rounded-2xl p-6">
      <header>
        <p className="text-eyebrow text-brand-700">
          Latest handoff · {latest.stage} v{latest.version}
        </p>
        <p className="text-body text-muted-foreground">
          Add specialist attesters on this handoff so the gate can be decided.
        </p>
      </header>
      <OracleAttestationList detail={detail} handoff={latest} onWritten={onWritten} />
    </section>
  );
}
