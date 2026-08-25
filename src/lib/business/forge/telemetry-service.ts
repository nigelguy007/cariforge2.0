// @polsia:user-owned — pure derived views for the autonomy + telemetry slice:
// gate decision counts per specialist/gate, release actor derivation from
// ApprovalActorTag rows, draft-age bucketisation, and admin overview scan.
// No DB; called from /api/forge/missions/[id]/telemetry and
// /api/forge/admin/telemetry.
import type {
  ApprovalDecision,
  HandoffItemT,
  MissionStatus,
  StageName,
} from '@/lib/contracts/forge';

export type ReleaseActorValue = 'AIOnly' | 'Human' | 'Hybrid';

export interface GateDecisionCount {
  gateIndex: number;
  stage: StageName;
  approved: number;
  edited: number; // Return + Correction-friendly count
  rejected: number;
  aiOnlyApprovals: number; // from ApprovalActorTag joins
  humanApprovals: number;
}

export function gateDecisionCounts(
  approvals: ReadonlyArray<{
    gateIndex: number;
    decision: ApprovalDecision;
    id?: string;
  }>,
  actorTagsByApproval: ReadonlyMap<string, ReadonlyArray<{ actorKind: string }>>,
  stagesByGate: ReadonlyMap<number, StageName>,
): GateDecisionCount[] {
  const byGate = new Map<number, GateDecisionCount>();
  const stageOrder: StageName[] = [
    'Discovery',
    'Readiness',
    'Workflow',
    'Governance',
    'SoftwareBuild',
  ];
  for (let i = 0; i < stageOrder.length; i++) {
    const stage = stageOrder[i] ?? 'Discovery';
    byGate.set(i, {
      gateIndex: i,
      stage,
      approved: 0,
      edited: 0,
      rejected: 0,
      aiOnlyApprovals: 0,
      humanApprovals: 0,
    });
  }
  for (const ap of approvals) {
    const entry = byGate.get(ap.gateIndex) ?? byGate.get(0);
    if (!entry) continue;
    if (ap.decision === 'Approve') {
      entry.approved += 1;
      const tags = ap.id ? actorTagsByApproval.get(ap.id) : undefined;
      if (tags && tags.length > 0) {
        // Tag set drives the AI/Human attribution for this approval.
        const allAI = tags.every((t) => t.actorKind === 'AI');
        const anyHuman = tags.some((t) => t.actorKind === 'Human');
        if (allAI && !anyHuman) entry.aiOnlyApprovals += 1;
        else if (anyHuman) entry.humanApprovals += 1;
      }
    } else if (ap.decision === 'Return') {
      entry.edited += 1;
    } else {
      entry.rejected += 1;
    }
  }
  for (const entry of byGate.values()) {
    const sStage = stagesByGate.get(entry.gateIndex);
    if (sStage) entry.stage = sStage;
  }
  return Array.from(byGate.values()).sort((a, b) => a.gateIndex - b.gateIndex);
}

export function deriveReleaseActor(
  approvals: ReadonlyArray<{ decision: ApprovalDecision; id?: string }>,
  actorTagsByApproval: ReadonlyMap<string, ReadonlyArray<{ actorKind: string }>>,
): ReleaseActorValue {
  // Honest default if nothing is tagged: Hybrid (mix assumed).
  let sawAI = false;
  let sawHuman = false;
  for (const ap of approvals) {
    if (ap.decision !== 'Approve') continue;
    const tags = ap.id ? actorTagsByApproval.get(ap.id) : undefined;
    if (!tags || tags.length === 0) continue;
    for (const tag of tags) {
      if (tag.actorKind === 'AI') sawAI = true;
      if (tag.actorKind === 'Human') sawHuman = true;
    }
  }
  if (!sawAI && !sawHuman) return 'Hybrid';
  if (sawAI && !sawHuman) return 'AIOnly';
  if (sawHuman && !sawAI) return 'Human';
  return 'Hybrid';
}

export interface DraftAgeBucket {
  daysOld: number;
  bucket: '<1d' | '1-3d' | '3-7d' | '7+d';
  isAwaiting: boolean; // true when there is an unreleased draft handoff
}

export function draftAge(
  now: Date,
  handoffs: readonly HandoffItemT[],
  missionStatus: MissionStatus,
  releaseCargo?: { releasedAt: Date | null } | null,
): DraftAgeBucket {
  // The "awaiting release" handoff is the latest non-superseded handoff for
  // any stage whose gate is still awaiting approval — unless the mission is
  // already in a release-state (Completed / Released / RolledBack / etc.).
  const releasedLocally = releaseCargo?.releasedAt ?? null;
  const released = isReleased(missionStatus) || releasedLocally !== null;
  if (released) {
    return { daysOld: 0, bucket: '<1d', isAwaiting: false };
  }
  const candidates = handoffs.filter((h) => !h.supersededById);
  if (candidates.length === 0) {
    // No unreleased drafts => mission is in a terminal-but-not-released state.
    return { daysOld: 0, bucket: '<1d', isAwaiting: false };
  }
  const oldest = candidates.reduce((acc, h) => {
    const t = new Date(h.createdAt).getTime();
    return t < acc ? t : acc;
  }, Number.POSITIVE_INFINITY);
  if (!Number.isFinite(oldest)) {
    return { daysOld: 0, bucket: '<1d', isAwaiting: true };
  }
  const daysOld = Math.max(0, Math.floor((now.getTime() - oldest) / (24 * 60 * 60 * 1000)));
  return { daysOld, bucket: bucketise(daysOld), isAwaiting: true };
}

function bucketise(daysOld: number): DraftAgeBucket['bucket'] {
  if (daysOld < 1) return '<1d';
  if (daysOld <= 3) return '1-3d';
  if (daysOld <= 7) return '3-7d';
  return '7+d';
}

function isReleased(status: MissionStatus): boolean {
  return status === 'Completed' || status === 'WalkedAway' || status === 'RolledBack';
}

// === Admin overview scan ===================================================

export interface AutonomyLadderRow {
  gateIndex: number;
  stage: StageName;
  approvedTotal: number;
  editedTotal: number;
  rejectedTotal: number;
  aiOnlyShare: number; // 0..1 fraction of AI-tagged approvals among approvals
}

export interface AdminOverviewScan {
  autonomyLadder: AutonomyLadderRow[];
  perCompanyCredit: Array<{ companyId: string; netCents: number; credits: number; debits: number }>;
  chatCostByDay: Array<{ day: string; cents: number; messages: number; hasUnknownCost: boolean }>;
}

export function adminOverview(args: {
  perGateCounts: ReadonlyArray<GateDecisionCount>;
  creditLedger: ReadonlyArray<{ companyId: string; amountCents: number }>;
  chatRows: ReadonlyArray<{
    windowStartIso: string;
    costCents: number;
    messageCount: number;
    unknownCost: boolean;
  }>;
}): AdminOverviewScan {
  // Autonomy ladder — row per gate, computed AI share as approvals fraction.
  const autonomyLadder: AutonomyLadderRow[] = args.perGateCounts.map((g) => {
    const denom = g.aiOnlyApprovals + g.humanApprovals;
    const aiOnlyShare = denom > 0 ? g.aiOnlyApprovals / denom : 0;
    return {
      gateIndex: g.gateIndex,
      stage: g.stage,
      approvedTotal: g.approved,
      editedTotal: g.edited,
      rejectedTotal: g.rejected,
      aiOnlyShare,
    };
  });

  // Per-company credit rollup — signed-net + separated credit/debit totals.
  const compMap = new Map<string, { companyId: string; credits: number; debits: number }>();
  for (const e of args.creditLedger) {
    const c = compMap.get(e.companyId) ?? { companyId: e.companyId, credits: 0, debits: 0 };
    if (e.amountCents > 0) c.credits += e.amountCents;
    else if (e.amountCents < 0) c.debits += -e.amountCents;
    compMap.set(e.companyId, c);
  }
  const perCompanyCredit = Array.from(compMap.values()).map((c) => ({
    companyId: c.companyId,
    credits: c.credits,
    debits: c.debits,
    netCents: c.credits - c.debits,
  }));

  // Chat cost by day (UTC) — already aggregated by the DB query.
  const dayMap = new Map<string, { cents: number; messages: number; hasUnknown: boolean }>();
  for (const r of args.chatRows) {
    const day = r.windowStartIso.slice(0, 10); // YYYY-MM-DD
    const c = dayMap.get(day) ?? { cents: 0, messages: 0, hasUnknown: false };
    c.cents += r.costCents;
    c.messages += r.messageCount;
    if (r.unknownCost) c.hasUnknown = true;
    dayMap.set(day, c);
  }
  const chatCostByDay = Array.from(dayMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, c]) => ({
      day,
      cents: c.cents,
      messages: c.messages,
      hasUnknownCost: c.hasUnknown,
    }));

  return { autonomyLadder, perCompanyCredit, chatCostByDay };
}
