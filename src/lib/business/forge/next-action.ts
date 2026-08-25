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
  if (input.status === 'WalkedAway' || input.status === 'Rejected') {
    return { kind: 'Complete', title: 'Mission is closed without release.' };
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
  if (gateToActOn) {
    return {
      kind: 'ApproveGate',
      gateIndex: gateToActOn.gateIndex,
      stage: gateToActOn.stage,
      title: `Decide gate ${gateToActOn.gateIndex} — ${gateToActOn.name}`,
      rationale: gateToActOn.purpose,
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
  const pausedGates = input.gates.filter((g) => g.state === 'Returned' || g.state === 'Refused');
  if (pausedGates.length > 0) {
    out.push(`${pausedGates.length} gate(s) in non-Awaiting state (Returned or Refused).`);
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
): { gateIndex: number; stage: StageName; name: string; purpose: string } | null {
  // AwaitingApproval means a fresh handoff just landed — the next gate is the
  // one matching currentStageIndex (or that gate's index for that handoff).
  // For In<X> statuses, the next gate is the gate bound to stage X.
  if (status === 'AwaitingApproval') {
    const latest = approvals[0];
    const g = latest ? gates.find((gate) => gate.gateIndex === latest.gateIndex) : gates[0];
    if (!g) return null;
    if (g.state === 'Awaiting') return toGateShape(g);
    return null;
  }
  const stageMap: Partial<Record<MissionStatus, StageName>> = {
    Draft: 'Discovery',
    InDiscovery: 'Readiness',
    InReadiness: 'Workflow',
    InWorkflow: 'Governance',
    InGovernance: 'SoftwareBuild',
    InBuild: 'SoftwareBuild',
  };
  const targetStage = stageMap[status];
  if (!targetStage) return null;
  const gate = gates.find((g) => g.stage === targetStage && g.state === 'Awaiting');
  if (!gate) return null;
  return toGateShape(gate);
}

function toGateShape(g: GateStateT) {
  const def = GATE_DEFS[g.gateIndex];
  return {
    gateIndex: g.gateIndex,
    stage: g.stage,
    name: def?.name ?? `Gate ${g.gateIndex}`,
    purpose: def?.purpose ?? 'No purpose recorded.',
  };
}
