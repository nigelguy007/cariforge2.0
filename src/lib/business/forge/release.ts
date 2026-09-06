// @polsia:user-owned — pure derived views: release status, blueprint, runbook.
// No DB. Called from /api/forge/missions/:id/release, /blueprint, /runbook.

import type {
  ApprovalItemT,
  HandoffItemT,
  MissionDetailT,
  MissionStatus,
  ReleaseReadT,
} from '@/lib/contracts/forge';

export type DerivedReleaseStatus = ReleaseReadT['releaseStatus'];

const STATUS_TO_DERIVED: Record<MissionStatus, DerivedReleaseStatus> = {
  Draft: 'InProgress',
  InDiscovery: 'InProgress',
  InReadiness: 'InProgress',
  InWorkflow: 'InProgress',
  InGovernance: 'InProgress',
  InBuild: 'InProgress',
  AwaitingApproval: 'InProgress',
  Completed: 'Released',
  Paused: 'Paused',
  Blocked: 'Blocked',
  Rejected: 'Blocked',
  WalkedAway: 'WalkedAway',
  RolledBack: 'RolledBack',
};

export function deriveReleaseStatus(args: {
  status: MissionStatus;
  completedAt: string | null;
  releaseReadoutAt: string | null;
  lastApproval: ApprovalItemT | null;
}): DerivedReleaseStatus {
  const base = STATUS_TO_DERIVED[args.status];
  if (args.status === 'Completed' && !args.releaseReadoutAt) {
    // Build finished gating but no explicit release readout — show as
    // build-approved-not-released so the operator knows to mark it out.
    return 'BuildApprovedNotReleased';
  }
  return base;
}

export interface BlueprintSourceMission extends Pick<MissionDetailT['mission'], 'id' | 'name'> {
  releaseReadoutAt: string | null;
}

export function blueprintFromHandoffs(args: {
  mission: BlueprintSourceMission;
  handoffs: readonly HandoffItemT[];
}): {
  missionId: string;
  missionName: string;
  generatedAt: string;
  schemaVersion: string;
  title: string;
  summary: string;
  blocks: Array<{ heading: string; body: string; sourceStage: HandoffItemT['stage'] }>;
  reuseSignals: string[];
} {
  const validStages = args.handoffs.filter((h) => h.stage !== 'SoftwareBuild');
  const blocks = validStages.map((h, idx) => ({
    heading: `Stage ${idx + 1} — ${h.stage} v${h.version}`,
    body:
      h.payload && Object.keys(h.payload).length > 0 ? JSON.stringify(h.payload) : '(null payload)',
    sourceStage: h.stage,
  }));
  const buildStage = args.handoffs.find((h) => h.stage === 'SoftwareBuild' && !h.supersededById);
  if (buildStage) {
    // Renamed from "Prototype spec" (2026-09-05, direct user correction:
    // "this is creating the real build so any reference to prototype
    // needs to be changed" — matches gate 5's renamed GATE_DEFS.name,
    // "MVP build approved"). Display text only; the underlying `stage`
    // enum value stays 'SoftwareBuild' (see forge.ts's GATE_DEFS comment).
    blocks.push({
      heading: `MVP build — v${buildStage.version}`,
      body:
        buildStage.payload && Object.keys(buildStage.payload).length > 0
          ? JSON.stringify(buildStage.payload)
          : 'No MVP-build payload recorded.',
      sourceStage: 'SoftwareBuild',
    });
  }
  const summary =
    blocks.length === 0
      ? 'No handoffs recorded yet.'
      : `Captured ${blocks.length} stage artifacts. The MVP build is included if a SoftwareBuild handoff was recorded.`;
  const reuseSignals: string[] = [];
  if (buildStage) reuseSignals.push('MVP build handoff present — artifact is reusable.');
  if (validStages.length >= 5) reuseSignals.push('All five stages attested.');
  return {
    missionId: args.mission.id,
    missionName: args.mission.name,
    generatedAt: new Date().toISOString(),
    schemaVersion: 'forge-blueprint/v1',
    title: `Blueprint — ${args.mission.name}`,
    summary,
    blocks,
    reuseSignals,
  };
}

export function runbookFromHandoffs(args: {
  mission: BlueprintSourceMission;
  handoffs: readonly HandoffItemT[];
  releaseStatus: DerivedReleaseStatus;
}): {
  missionId: string;
  missionName: string;
  generatedAt: string;
  schemaVersion: string;
  title: string;
  steps: Array<{ heading: string; body: string; orderIndex: number }>;
  escalationContacts: Array<{ role: string; contact: string }>;
} {
  const steps = args.handoffs
    .filter((h) => !h.supersededById)
    .map((h, idx) => ({
      heading: `${h.stage} — step ${idx + 1}`,
      body: `Confidence ${(h.confidence * 100).toFixed(0)}%. ${h.missingEvidence && h.missingEvidence.length > 0 ? `Notable gaps: ${h.missingEvidence.length} missing-evidence items.` : 'No outstanding gaps recorded.'}`,
      orderIndex: idx,
    }));
  if (steps.length === 0) {
    steps.push({
      heading: 'Stand up the mission',
      body: 'Submit a Discovery handoff to begin.',
      orderIndex: 0,
    });
  }
  const escalationContacts: Array<{ role: string; contact: string }> = [
    { role: 'Owner', contact: args.mission.name },
  ];
  if (args.releaseStatus === 'RolledBack') {
    escalationContacts.push({
      role: 'Audit',
      contact: 'Review the rollback reason code in the evidence trail.',
    });
  }
  if (args.releaseStatus === 'Released') {
    escalationContacts.push({
      role: 'Operator',
      contact: 'Run the provided runbook steps on each environment cutover.',
    });
  }
  return {
    missionId: args.mission.id,
    missionName: args.mission.name,
    generatedAt: new Date().toISOString(),
    schemaVersion: 'forge-runbook/v1',
    title: `Runbook — ${args.mission.name}`,
    steps,
    escalationContacts,
  };
}
