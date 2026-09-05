// @polsia:user-owned — pure "next human action" derivation. No DB.
// Powers the Mission Control "next action" panel.

import type {
  ApprovalItemT,
  GateStateT,
  MissionStatus,
  NextActionViewT,
  ObjectionItemT,
  StageName,
  WorkItemReadT,
} from '@/lib/contracts/forge';
import { GATE_DEFS } from '@/lib/contracts/forge';

export interface NextActionInput {
  status: MissionStatus;
  gates: readonly GateStateT[];
  approvals: readonly ApprovalItemT[];
  objections: readonly ObjectionItemT[];
  toolActions: Array<{
    id: string;
    decision: 'Approved' | 'Denied' | null;
    tool: string;
    scope: 'Internal' | 'External';
  }>;
  workItems: readonly WorkItemReadT[];
}

export function nextActionFor(input: NextActionInput): NextActionViewT {
  if (input.status === 'Completed') {
    return { kind: 'Complete', title: 'Mission complete — nothing left to do.' };
  }
  if (input.status === 'Rejected') {
    // User-specified flow (2026-09-05): a refused gate — including an
    // Elder's "no" on gate 0/4 — ends the project with an apology and
    // advice to rethink, not a generic "complete" message.
    return {
      kind: 'Closed',
      status: 'Rejected',
      title: 'This project was not approved and has been closed.',
    };
  }
  if (input.status === 'WalkedAway') {
    return {
      kind: 'Closed',
      status: 'WalkedAway',
      title: 'This project was stopped before completion.',
    };
  }
  if (input.status === 'Paused') {
    return { kind: 'Resume', title: 'Mission is paused — resume to continue work.' };
  }
  if (input.status === 'Blocked') {
    return {
      kind: 'Pause',
      reason: 'Mission is blocked.',
      title: 'Mission is blocked — review and resume.',
    };
  }
  if (input.status === 'RolledBack') {
    return {
      kind: 'Replay',
      fromStageIndex: 0,
      title: 'Mission was rolled back — restart from Discovery to rebuild.',
    };
  }

  const outstandingObjection = input.objections.find((o) => o.resolution === null);
  if (outstandingObjection) {
    return {
      kind: 'ResolveObjection',
      id: outstandingObjection.id,
      raisedByRole: outstandingObjection.raisedByRole,
      title: `Resolve an objection raised by ${outstandingObjection.raisedByRole}`,
      rationale: outstandingObjection.text,
    };
  }

  const outstandingToolAction = input.toolActions.find((t) => t.decision === null);
  if (outstandingToolAction) {
    return {
      kind: 'DecideToolAction',
      id: outstandingToolAction.id,
      tool: outstandingToolAction.tool,
      scope: outstandingToolAction.scope,
      title: `Decide ${outstandingToolAction.tool} (${outstandingToolAction.scope})`,
      rationale:
        outstandingToolAction.scope === 'External'
          ? 'External tool actions require gate approval to proceed.'
          : 'Pending tool-action decision — approve or deny before continuing.',
    };
  }

  const inFlightWorkItem = input.workItems.find(
    (w) => w.status === 'Open' || w.status === 'InProgress' || w.status === 'Rework',
  );
  if (inFlightWorkItem) {
    return {
      kind: 'ArrangeWorkItem',
      itemId: inFlightWorkItem.id,
      title: `Drive work item "${inFlightWorkItem.title}" through ${inFlightWorkItem.status}`,
    };
  }

  const gateToActOn = pickNextGate(input.status, input.gates, input.approvals);
  if (gateToActOn?.state === 'Returned') {
    // Real dead end found live (2026-09-05): a Returned gate used to fall
    // straight through to the generic 'Idle' branch below — "Nothing
    // needs you right now" with no button — because pickNextGate only
    // ever matched gates still in 'Awaiting'. The reviewer's own written
    // feedback was recorded on the Return approval the whole time; it
    // was just never surfaced as the next action.
    const latestReturn = [...input.approvals]
      .filter((a) => a.gateIndex === gateToActOn.gateIndex && a.decision === 'Return')
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    const def = GATE_DEFS[gateToActOn.gateIndex];
    return {
      kind: 'ReviseStage',
      gateIndex: gateToActOn.gateIndex,
      stage: gateToActOn.stage,
      title: `Add more information to ${def?.name ?? `gate ${gateToActOn.gateIndex}`}`,
      rationale:
        latestReturn?.reasonText?.trim() ||
        'Reviewers asked for more information before this step can move forward.',
    };
  }
  if (gateToActOn?.state === 'Awaiting') {
    const def = GATE_DEFS[gateToActOn.gateIndex];
    return {
      kind: 'ApproveGate',
      gateIndex: gateToActOn.gateIndex,
      stage: gateToActOn.stage,
      title: `Decide gate ${gateToActOn.gateIndex} — ${def?.name ?? `Gate ${gateToActOn.gateIndex}`}`,
      rationale: def?.purpose ?? 'No purpose recorded.',
    };
  }

  return { kind: 'Idle', title: 'Mission is idle — submit a handoff to drive it forward.' };
}

export function nextActionBlockers(input: NextActionInput): readonly string[] {
  const out: string[] = [];
  const outstandingObjections = input.objections.filter((o) => o.resolution === null);
  if (outstandingObjections.length > 0) {
    out.push(`${outstandingObjections.length} unresolved objection(s).`);
  }
  const outstandingToolActions = input.toolActions.filter((t) => t.decision === null);
  if (outstandingToolActions.length > 0) {
    out.push(`${outstandingToolActions.length} tool-action decision(s) pending.`);
  }
  // 'Returned' is deliberately excluded here: nextActionFor now surfaces
  // it directly as the 'ReviseStage' next action itself (2026-09-05), so
  // listing it a second time as a "blocker" alongside that would just
  // repeat the same fact in a more confusing shape.
  const refusedGates = input.gates.filter((g) => g.state === 'Refused');
  if (refusedGates.length > 0) {
    out.push(`${refusedGates.length} gate(s) refused.`);
  }
  return out;
}

export function isMissionTerminal(status: MissionStatus): boolean {
  return status === 'Completed' || status === 'WalkedAway' || status === 'Rejected';
}

function pickNextGate(
  status: MissionStatus,
  gates: readonly GateStateT[],
  approvals: readonly ApprovalItemT[],
): GateStateT | null {
  // AwaitingApproval means a fresh handoff just landed — the next gate is the
  // one matching currentStageIndex (or that gate's index for that handoff).
  // For In<X> statuses, the next gate is the gate bound to stage X: a
  // mission whose status is "InDiscovery" is actively WORKING Discovery,
  // so the gate awaiting a decision is Discovery's own gate (0) — not the
  // next stage's, which hasn't started.
  //
  // FIXED 2026-09-04: this map used to point one stage AHEAD of the
  // status (InDiscovery -> Readiness's gate, etc.) — found by walking a
  // real mission end-to-end: right after transitions/start (status
  // InDiscovery, gate 0 still Awaiting, zero handoffs submitted), this
  // panel told a real user to "Decide gate 1 — Ready for workflow," a
  // stage that hadn't even started. Only InBuild -> SoftwareBuild was
  // already correct (nothing further to be off into).
  //
  // Returns the full gate row (not just an Awaiting one) since the
  // caller now needs to tell 'Awaiting' (needs a decision) apart from
  // 'Returned' (needs to be reworked and resubmitted) itself.
  if (status === 'AwaitingApproval') {
    const latest = approvals[0];
    const g = latest ? gates.find((gate) => gate.gateIndex === latest.gateIndex) : gates[0];
    return g?.state === 'Awaiting' ? g : null;
  }
  const stageMap: Partial<Record<MissionStatus, StageName>> = {
    Draft: 'Discovery',
    InDiscovery: 'Discovery',
    InReadiness: 'Readiness',
    InWorkflow: 'Workflow',
    InGovernance: 'Governance',
    InBuild: 'SoftwareBuild',
  };
  const targetStage = stageMap[status];
  if (!targetStage) return null;
  return gates.find((g) => g.stage === targetStage) ?? null;
}
