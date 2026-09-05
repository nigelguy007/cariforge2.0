// @polsia:user-owned — the "Office" view (Phase 1 of the Agent Command
// Centre handoff, scoped down after user confirmation on 2026-09-05: use
// the real 5-stage pipeline — Discovery/Readiness/Workflow/Governance/
// SoftwareBuild — not the handoff document's own fictional 7-agent model,
// which invents two stages ("Partner & Enabler", "Impact") that don't
// exist anywhere in this codebase. No fabricated telemetry, no invented
// metrics (handoff's own Rule 4) — every node's state comes straight from
// the same real MissionDetailT this app already fetches; nothing here is
// a second source of truth. 3D/WebGL, the workflow-builder revival, and
// live Claude Code hook telemetry are explicitly out of scope for this
// pass — see the user's own scoping decision.
//
// A real, interactive node-graph: each of the 5 stages is a node showing
// its actual state (done / working / needs your decision / not started),
// with animated connectors between them. Clicking a node reveals the same
// real detail agent-activity-panel.tsx already knows how to show
// (AgentStepDetail, reused directly — no duplicated logic). Includes its
// own "Draft with AI" trigger so this page is a genuinely complete way to
// drive the mission forward, not just a read-only mirror of the workspace
// page — the same governed multi-stage auto-chain next-action-card.tsx
// uses, adapted here rather than shared via a hook, to avoid touching an
// already-fixed, already-tested component for this first pass.

'use client';

import { Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { AgentStepDetail } from '@/components/custom/app/agent-activity-panel';
import { useProjectWorkspace } from '@/components/custom/app/use-project-workspace';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { useIsAdmin, useSession } from '@/lib/auth-client';
import { nextActionFor } from '@/lib/business/forge/next-action';
import { MissionDetail, type StageName } from '@/lib/contracts/forge';
import { AGENT_ACTIVITY_UI, STEPS } from '@/lib/ui-terms';

type NodeStatus = 'done' | 'working' | 'needs-you' | 'pending';

function statusRingClass(status: NodeStatus): string {
  switch (status) {
    case 'done':
      return 'border-emerald-500/70 bg-emerald-500/10';
    case 'working':
      return 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] animate-pulse';
    case 'needs-you':
      return 'border-amber-500/70 bg-amber-500/10';
    case 'pending':
      return 'border-[var(--app-border)] bg-[var(--app-surface)]';
  }
}

function statusLabel(status: NodeStatus): string {
  switch (status) {
    case 'done':
      return 'Done';
    case 'working':
      return 'Working…';
    case 'needs-you':
      return 'Needs you';
    case 'pending':
      return 'Not started';
  }
}

function connectorClass(leftDone: boolean, rightWorking: boolean): string {
  if (rightWorking)
    return 'bg-gradient-to-r from-emerald-500/60 via-[var(--app-accent)] to-transparent animate-pulse';
  if (leftDone) return 'bg-emerald-500/50';
  return 'bg-[var(--app-border)]';
}

function OfficeSkeleton() {
  return (
    <div className="app-content space-y-6" aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-64 w-full rounded-[var(--app-radius)]" />
    </div>
  );
}

export function MissionOfficeView({ missionSlug }: { missionSlug: string }) {
  const { state, refresh } = useProjectWorkspace(missionSlug);
  const isAdmin = useIsAdmin();
  const { data: session } = useSession();
  const [selectedStage, setSelectedStage] = React.useState<StageName | null>(null);
  const [drafting, setDrafting] = React.useState(false);
  const [draftingStage, setDraftingStage] = React.useState<StageName | null>(null);

  if (state.status === 'loading') return <OfficeSkeleton />;
  if (state.status === 'error') {
    return (
      <div className="app-content">
        <p className="app-body text-[var(--app-text-muted)]">{state.message}</p>
      </div>
    );
  }

  const { detail, view } = state;
  const canDraft = isAdmin || detail.mission.createdById === session?.user?.id;
  const action = view.nextAction.view;

  const nodes = STEPS.map((step) => {
    const stepIndex = STEPS.indexOf(step);
    const handoff =
      detail.handoffs.find((h) => h.stage === step.stage && h.supersededById === null) ?? null;
    const done = handoff !== null;
    const gate = detail.gates.find((g) => g.gateIndex === stepIndex);
    const approval = detail.approvals
      .filter((a) => a.gateIndex === stepIndex)
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    const objections = handoff
      ? detail.objections.filter((o) => o.stageHandoffId === handoff.id)
      : [];
    const hasOpenConcern = objections.some((o) => o.resolution === null);
    const working = !done && step.stage === draftingStage;
    const needsDecision = !done && gate?.state === 'Awaiting' && gate.currentStageHandoffId != null;
    let status: NodeStatus = 'pending';
    if (working) status = 'working';
    else if (hasOpenConcern || needsDecision) status = 'needs-you';
    else if (done) status = 'done';
    return { step, handoff, gate, approval, objections, status, done };
  });

  const selected = nodes.find((n) => n.step.stage === selectedStage) ?? null;

  const MAX_AUTO_STAGES = 5;
  async function draftWithAi() {
    setDrafting(true);
    let currentStage: StageName | null =
      action.kind === 'ApproveGate' || action.kind === 'ReviseStage' ? action.stage : null;
    try {
      let stepsDrafted = 0;
      for (let i = 0; i < MAX_AUTO_STAGES; i++) {
        setDraftingStage(currentStage);
        const updated = await apiFetch(`/api/forge/missions/${detail.mission.id}/draft`, {
          method: 'POST',
          schema: MissionDetail,
        });
        stepsDrafted += 1;
        const nextView = nextActionFor({
          status: updated.mission.status,
          gates: updated.gates,
          approvals: updated.approvals,
          objections: updated.objections,
          toolActions: updated.toolActions.map((t) => ({
            id: t.id,
            decision: t.decision,
            tool: t.tool,
            scope: t.scope,
          })),
          workItems: updated.workItems ?? [],
        });
        const nextGate =
          nextView.kind === 'ApproveGate'
            ? (updated.gates.find((g) => g.gateIndex === nextView.gateIndex) ?? null)
            : null;
        if (!nextGate || nextGate.currentStageHandoffId) break;
        if (nextView.kind !== 'ApproveGate') break;
        currentStage = nextView.stage;
      }
      toast.success(
        stepsDrafted > 1
          ? `CariForge worked through ${stepsDrafted} steps on its own — watch the office above.`
          : 'CariForge drafted this step.',
      );
      await refresh();
    } catch (err) {
      const cause = (err as { cause?: { error?: string } }).cause;
      toast.error(cause?.error ?? 'Could not draft this step. Try again shortly.');
    } finally {
      setDrafting(false);
      setDraftingStage(null);
    }
  }

  const canTriggerDraft =
    canDraft && (action.kind === 'ApproveGate' || action.kind === 'ReviseStage') && !drafting;

  return (
    <div className="app-content space-y-6">
      <header>
        <p className="app-caption text-[var(--app-text-muted)]">Office view</p>
        <h1 className="app-h1 text-[var(--app-text)]">{view.project.name}</h1>
        <p className="app-body mt-1 max-w-prose text-[var(--app-text-muted)]">
          Watch each real agent's status live, click one for detail, or start the next stage
          yourself.
        </p>
      </header>

      <div className="app-panel overflow-x-auto p-6 sm:p-8">
        <div className="flex min-w-[720px] items-center">
          {nodes.map((n, i) => {
            const prev = i > 0 ? nodes[i - 1] : undefined;
            return (
              <React.Fragment key={n.step.stage}>
                {prev ? (
                  <div
                    aria-hidden="true"
                    className={`h-1 flex-1 rounded-full ${connectorClass(prev.done, n.status === 'working')}`}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedStage(n.step.stage === selectedStage ? null : n.step.stage)
                  }
                  aria-expanded={n.step.stage === selectedStage}
                  className={`app-transition flex shrink-0 flex-col items-center gap-2 rounded-[var(--app-radius)] border-2 p-4 ${statusRingClass(n.status)} ${n.step.stage === selectedStage ? 'ring-2 ring-[var(--app-accent)] ring-offset-2 ring-offset-[var(--app-bg)]' : ''}`}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-[var(--app-surface)] text-[var(--app-text)]">
                    {n.status === 'working' ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                    ) : n.status === 'done' ? (
                      <Check className="size-5 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <span className="app-small font-semibold">{i + 1}</span>
                    )}
                  </div>
                  <span className="app-small whitespace-nowrap font-medium text-[var(--app-text)]">
                    {AGENT_ACTIVITY_UI[n.step.stage].agent}
                  </span>
                  <span className="app-caption whitespace-nowrap text-[var(--app-text-muted)]">
                    {statusLabel(n.status)}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {canTriggerDraft ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void draftWithAi()}
            disabled={drafting}
            className="min-h-11"
          >
            {drafting
              ? 'Working…'
              : action.kind === 'ReviseStage'
                ? 'Redraft with AI'
                : 'Draft with AI'}
          </Button>
          <Link href={`/missions/${missionSlug}`} className="app-link app-small">
            Back to project workspace
          </Link>
        </div>
      ) : (
        <Link href={`/missions/${missionSlug}`} className="app-link app-small">
          Back to project workspace
        </Link>
      )}

      {selected ? (
        <div className="app-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="app-h3 text-[var(--app-text)]">
              {AGENT_ACTIVITY_UI[selected.step.stage].agent}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedStage(null)}
              className="app-small text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            >
              Close
            </button>
          </div>
          <AgentStepDetail
            step={selected.step}
            handoff={selected.handoff}
            gate={selected.gate}
            approval={selected.approval}
            objections={selected.objections}
          />
        </div>
      ) : (
        <p className="app-small text-[var(--app-text-muted)]">
          Click any agent above to see what it was asked to do and what it produced.
        </p>
      )}
    </div>
  );
}
