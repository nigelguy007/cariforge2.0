// @polsia:user-owned — TAG Caribbean pilot governance layer. Pure: no DB.
// Defines the five named human gates of The Oracles and the Elder Oracle
// pre-conditions that gate decisions must satisfy before the existing
// decideGate logic is allowed to run. Called from /api/forge/* auth seam
// and from decideGate() in service.ts.
//
// Governance terms:
//   - The Oracles: five named human approvers, one per gate. Their role
//     names are the visible per-stage label callers see in the UI.
//   - Elder Oracle: a separate, named human appointed by a CARI Forge
//     admin per mission. The Elder is the ONLY legal approver of gate 0
//     (Need Discovery) and gate 4 (Software Build). The decision with
//     approverUserId !== mission.elderOracleUserId at gates 0 or 4 throws
//     FORGE_ATTRIBUTION_MISSING.
//   - Specialists: per-handoff typed attesters (Risk / Demand / Growth /
//     Competition / Money) recorded on StageHandoffSpecialistAttester. At
//     least ONE attester must exist on the handoff being decided before
//     the gate can be decided — that's the typed "specialist voice" for
//     the stage.
//   - Closed missions with no Elder appointment throw FORGE_GATE_LOCKED
//     when someone tries to decide a gate-0/4 row.

import { ELDER_ORACLE_GATE_INDEXES, type OracleRole, type StageName } from '@/lib/contracts/forge';
import { FORGE_ERROR_CODES, ForgeError } from './state-machine';

export { ForgeError, FORGE_ERROR_CODES, ELDER_ORACLE_GATE_INDEXES };

// The visible, "naming-language" labels for each Oracle. The five gates
// map 1:1 onto gateIndex 0..4; ElderOracle sits outside the gate ladder.
export const ORACLE_ROLE_NAMES: Record<OracleRole, { name: string; stage: StageName | null }> = {
  NeedOracle: { name: 'Need Oracle', stage: 'Discovery' },
  ReadinessOracle: { name: 'Readiness Oracle', stage: 'Readiness' },
  WorkflowOracle: { name: 'Workflow Oracle', stage: 'Workflow' },
  GovernanceOracle: { name: 'Governance Oracle', stage: 'Governance' },
  BuildOracle: { name: 'Build Oracle', stage: 'SoftwareBuild' },
  ElderOracle: { name: 'Elder Oracle', stage: null },
};

export function oracleRoleForGateIndex(gateIndex: number): OracleRole | null {
  switch (gateIndex) {
    case 0:
      return 'NeedOracle';
    case 1:
      return 'ReadinessOracle';
    case 2:
      return 'WorkflowOracle';
    case 3:
      return 'GovernanceOracle';
    case 4:
      return 'BuildOracle';
    default:
      return null;
  }
}

export function isElderGate(gateIndex: number): boolean {
  return (ELDER_ORACLE_GATE_INDEXES as readonly number[]).includes(gateIndex);
}

// Input shape that carries the fields decideGate + the API seam need from
// the mission + the requesting user to evaluate the Elder rule. Kept as
// a small interface so tests can construct it without a Prisma row.
export interface ElderOracleMissionShape {
  readonly elderOracleUserId: string | null;
  readonly missionId?: string;
}

// Optional handoff attester snapshot. Empty + gateIndex inside ElderGate
// is a hard fail; otherwise an empty list is fine.
export interface HandoffAttesterSnapshot {
  readonly attesterUserIds: readonly string[];
}

// assertElderOracleAttested — pure precondition. Called inside decideGate
// before any state is mutated. Throws ForgeError(FORGE_GATE_LOCKED) when
// the mission has NO Elder Oracle assignment but a gate-0/4 decision is
// requested; throws ForgeError(FORGE_ATTRIBUTION_MISSING) when the Elder
// is assigned but the current approver is not the Elder.
export function assertElderOracleAttested(
  mission: ElderOracleMissionShape,
  approverUserId: string,
  gateIndex: number,
): void {
  if (!isElderGate(gateIndex)) return;
  if (!mission.elderOracleUserId) {
    throw new ForgeError(
      FORGE_ERROR_CODES.GATE_LOCKED,
      `Gate ${gateIndex} requires a named Elder Oracle; mission ${mission.missionId ?? '<unknown>'} has none appointed.`,
    );
  }
  if (approverUserId !== mission.elderOracleUserId) {
    throw new ForgeError(
      FORGE_ERROR_CODES.ATTRIBUTION_MISSING,
      `Gate ${gateIndex} may only be approved by the named Elder Oracle; approver ${approverUserId} is not the appointed Elder.`,
    );
  }
}

// assertSpecialistAttestersPresent — pure precondition. Every gate decision
// (not just the Elder gates) needs at least one specialist attester on the
// handoff. Empty attesters throw FORGE_ATTRIBUTION_MISSING.
export function assertSpecialistAttestersPresent(
  handoff: HandoffAttesterSnapshot,
  gateIndex: number,
): void {
  if (handoff.attesterUserIds.length === 0) {
    throw new ForgeError(
      FORGE_ERROR_CODES.ATTRIBUTION_MISSING,
      `Gate ${gateIndex} requires at least one specialist attester on the handoff.`,
    );
  }
}
