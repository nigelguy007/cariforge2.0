// @polsia:user-owned — presentation adapter for the simplified workspace.
//
// The DB enums, API contracts and governance rules in src/lib/contracts/forge.ts
// are unchanged. Everything a first-time business user reads in the
// authenticated app is translated HERE, at render time, so the raw values
// (`InDiscovery`, `EvidenceRequested`, `ElderOracle`, zero-based gate
// indexes, "Agent 3") never reach the screen. Every UI component imports
// from this file instead of reaching for the raw enum strings.
//
// Rule of thumb: if a string is going to be shown to a person, it goes
// through one of these maps. If it is going to be sent to the API, it stays
// the raw enum value.

import {
  type ApprovalDecision,
  GATE_DEFS,
  type MissionStatus,
  type ObjectionResolution,
  type OracleRole,
  type ReasonCode,
  type StageName,
  StageNameValues,
} from '@/lib/contracts/forge';

// === Steps (stages) =========================================================

export interface StageUi {
  /** One-based step number shown to the user (never the zero-based gate index). */
  readonly number: 1 | 2 | 3 | 4 | 5;
  /** Short label for the horizontal stepper. */
  readonly short: string;
  /** Step heading on the project workspace. */
  readonly title: string;
  /** Label of the single primary button when this step needs approval. */
  readonly action: string;
  /** The one sentence under the step heading on the project workspace. */
  readonly sentence: string;
}

export const STAGE_UI: Readonly<Record<StageName, StageUi>> = {
  Discovery: {
    number: 1,
    short: 'Need',
    title: 'Define the need',
    action: 'Confirm need and continue',
    sentence: 'Agree what the business needs before anything is designed.',
  },
  Readiness: {
    number: 2,
    short: 'Ready',
    title: 'Check readiness',
    action: 'Confirm readiness and continue',
    sentence: 'Confirm the people, data and constraints are in place to go ahead.',
  },
  Workflow: {
    number: 3,
    short: 'Workflow',
    title: 'Design the workflow',
    action: 'Approve workflow and continue',
    sentence: 'Review the proposed steps, roles and handovers for the work.',
  },
  Governance: {
    number: 4,
    short: 'Controls',
    title: 'Set the controls',
    action: 'Confirm controls and continue',
    sentence: 'Decide what the prototype may do, who approves it and what evidence it must keep.',
  },
  SoftwareBuild: {
    number: 5,
    short: 'Prototype',
    title: 'Approve the prototype',
    action: 'Approve prototype package',
    sentence:
      'Approve the runnable prototype package — a prototype with its plan, operating guide and evidence, not a production deployment.',
  },
};

export type StepUi = StageUi & { readonly stage: StageName };

/** Ordered list of steps, 1..5, for the stepper. */
export const STEPS: readonly StepUi[] = StageNameValues.map((stage) => ({
  stage,
  ...STAGE_UI[stage],
}));

/** Zero-based gate/stage index (API) → step UI. Out-of-range falls back to step 1. */
export function stageUiForIndex(index: number): StepUi {
  const stage = StageNameValues[index] ?? StageNameValues[0];
  return { stage, ...STAGE_UI[stage] };
}

/** "Step 3 · Design the workflow" — for headings, breadcrumbs and list rows. */
export function stepLabel(stage: StageName): string {
  const ui = STAGE_UI[stage];
  return `Step ${ui.number} · ${ui.title}`;
}

/** Zero-based gate index → "Step N" (never "Gate N"). */
export function stepNumberLabel(gateIndex: number): string {
  return `Step ${stageUiForIndex(gateIndex).number}`;
}

/** The approval name a business user sees for a gate (GATE_DEFS.name stays for exports). */
export function approvalNameForIndex(gateIndex: number): string {
  const ui = stageUiForIndex(gateIndex);
  return `${ui.title} — approval`;
}

// === Project status ===========================================================

export const STATUS_UI: Readonly<Record<MissionStatus, string>> = {
  Draft: 'Draft',
  InDiscovery: 'Defining the need',
  InReadiness: 'Checking readiness',
  InWorkflow: 'Designing the workflow',
  InGovernance: 'Setting controls',
  InBuild: 'Building the prototype',
  AwaitingApproval: 'Needs approval',
  Paused: 'Paused',
  Blocked: 'Needs information',
  Rejected: 'Stopped',
  Completed: 'Complete',
  WalkedAway: 'Not proceeding',
  RolledBack: 'Earlier version restored',
};

export type StatusTone = 'neutral' | 'progress' | 'attention' | 'paused' | 'stopped' | 'done';

/** Semantic tone for StatusBadge — colour is never the only signal (label always shown). */
export const STATUS_TONE: Readonly<Record<MissionStatus, StatusTone>> = {
  Draft: 'neutral',
  InDiscovery: 'progress',
  InReadiness: 'progress',
  InWorkflow: 'progress',
  InGovernance: 'progress',
  InBuild: 'progress',
  AwaitingApproval: 'attention',
  Paused: 'paused',
  Blocked: 'attention',
  Rejected: 'stopped',
  Completed: 'done',
  WalkedAway: 'stopped',
  RolledBack: 'paused',
};

export function statusLabel(status: MissionStatus): string {
  return STATUS_UI[status];
}

// A distinct enum from MissionStatus (ReleaseRead.releaseStatus) — the
// release panel's own view of where the build stands. Same "never a raw
// enum on screen" rule.
export const RELEASE_STATUS_UI: Readonly<Record<string, string>> = {
  Released: 'Released',
  BuildApprovedNotReleased: 'Approved, not yet released',
  Paused: 'Paused',
  RolledBack: 'Earlier version restored',
  WalkedAway: 'Not proceeding',
  Blocked: 'Needs information',
  InProgress: 'In progress',
};

// === Decisions ================================================================

/** What the four decision choices are called on screen. Sent to the API as the raw enum. */
export const DECISION_UI: Readonly<Record<ApprovalDecision, string>> = {
  Approve: 'Approve',
  ApproveWithControls: 'Approve with conditions',
  Return: 'Ask for changes',
  Refuse: 'Stop this project',
};

export interface DecisionOption {
  readonly value: ApprovalDecision;
  readonly label: string;
  readonly hint: string;
  /** Extra field the dialog must reveal for this choice, if any. */
  readonly needs?: 'controls';
}

/** Order the DecisionDialog renders its options in. */
export const DECISION_OPTIONS: readonly DecisionOption[] = [
  { value: 'Approve', label: DECISION_UI.Approve, hint: 'Move to the next step.' },
  {
    value: 'ApproveWithControls',
    label: DECISION_UI.ApproveWithControls,
    hint: 'Move on, but record conditions that must be met.',
    needs: 'controls',
  },
  {
    value: 'Return',
    label: DECISION_UI.Return,
    hint: 'Send this step back with what needs to change.',
  },
  {
    value: 'Refuse',
    label: DECISION_UI.Refuse,
    hint: 'Do not proceed. Recorded permanently.',
  },
];

/** Reason codes translated for the screen. The raw code still goes to the API. */
export const REASON_UI: Readonly<Record<ReasonCode, string>> = {
  Approved: 'Approved',
  EvidenceRequested: 'More information needed',
  ScopeMismatch: 'Does not match the agreed scope',
  GovernanceViolation: 'Breaks a control or policy',
  DemandUnverified: 'Demand not yet confirmed',
  WalkAway: 'Not worth proceeding',
  StaleInformation: 'Information is out of date',
  OrderingCorrected: 'Order of steps corrected',
  Replanned: 'Plan changed',
  UserCorrection: 'Corrected by the requester',
  ReplayRequired: 'Needs to be run again',
  InsufficientConfidence: 'Not confident enough yet',
  Other: 'Other reason',
};

export function reasonLabel(code: ReasonCode): string {
  return REASON_UI[code];
}

// === Concerns (objections) ==================================================

export const OBJECTION_RESOLUTION_UI: Readonly<Record<ObjectionResolution, string>> = {
  Overruled: 'Overruled by the reviewer',
  CarriedForward: 'Carried forward, with the concern on record',
  OwnerResolved: 'Resolved by the project owner',
  Closed: 'Closed',
};

/**
 * The reason code the dialog pre-selects for each decision, chosen from the
 * gate's own allowedReasonCodes so the API never rejects the default. The
 * user can still change it in the "Decision note" section.
 */
export function defaultReasonFor(decision: ApprovalDecision, gateIndex: number): ReasonCode {
  const allowed = GATE_DEFS[gateIndex]?.allowedReasonCodes ?? ['Other'];
  const preferred: readonly ReasonCode[] =
    decision === 'Approve' || decision === 'ApproveWithControls'
      ? ['Approved']
      : decision === 'Return'
        ? ['EvidenceRequested', 'UserCorrection', 'ScopeMismatch', 'Replanned']
        : ['WalkAway', 'GovernanceViolation', 'ScopeMismatch', 'DemandUnverified'];
  return preferred.find((c) => allowed.includes(c)) ?? allowed[0] ?? 'Other';
}

/** Pre-drafted, editable decision note shown in the dialog. */
export function draftDecisionNote(decision: ApprovalDecision, stage: StageName): string {
  const step = STAGE_UI[stage];
  const what = `step ${step.number} (${step.title.toLowerCase()})`;
  switch (decision) {
    case 'Approve':
      return `Reviewed ${what} and confirmed it is ready to continue.`;
    case 'ApproveWithControls':
      return `Reviewed ${what}. Approved on the condition that the listed controls are met before the next step.`;
    case 'Return':
      return `Reviewed ${what}. Needs the following changes before it can continue: `;
    case 'Refuse':
      return `Reviewed ${what}. Stopping this project because: `;
  }
}

// === People / roles ===========================================================

/** Council roles as a person would describe them. Never "ElderOracle" on screen. */
export const ROLE_UI: Readonly<Record<OracleRole, string>> = {
  NeedOracle: 'Need reviewer',
  ReadinessOracle: 'Readiness reviewer',
  WorkflowOracle: 'Workflow reviewer',
  GovernanceOracle: 'Controls reviewer',
  BuildOracle: 'Prototype reviewer',
  ElderOracle: 'Council Chair',
};

export function roleLabel(role: string): string {
  return (ROLE_UI as Record<string, string>)[role] ?? humanise(role);
}

// === Generic term map ========================================================

/**
 * Old product nouns → plain-language nouns. Used for copy that still arrives
 * from the API as free text (next-action titles, audit summaries) so a
 * "Gate 2" or "Elder Oracle" written server-side is corrected on the way
 * to the screen. Order matters: longer phrases first.
 */
const TERM_MAP: readonly (readonly [RegExp, string])[] = [
  [/\bCarried dissent\b/g, 'Carried-forward concern'],
  [/\bcarried dissent\b/g, 'carried-forward concern'],
  [/\bElder Oracle\b/g, 'Council Chair'],
  [/\bSpecialist attester\b/g, 'Specialist reviewer'],
  [/\bspecialist attester\b/g, 'specialist reviewer'],
  [/\bApproveWithControls\b/g, 'Approve with conditions'],
  [/\bAudit trail\b/g, 'Decision record'],
  [/\baudit trail\b/g, 'decision record'],
  [/\bWork item\b/g, 'Task'],
  [/\bwork item\b/g, 'task'],
  [/\bAn objection\b/g, 'A concern'],
  [/\ban objection\b/g, 'a concern'],
  [/\bObjection\b/g, 'Concern'],
  [/\bobjection\b/g, 'concern'],
  [/\bDissent\b/g, 'Concern'],
  [/\bdissent\b/g, 'concern'],
  [/\bHandoff\b/g, 'Step output'],
  [/\bhandoff\b/g, 'step output'],
  [/\bSupervisor\b/g, 'Approver'],
  [/\bsupervisor\b/g, 'approver'],
  [/\bRunbook\b/g, 'Operating guide'],
  [/\bBlueprint\b/g, 'Project plan'],
  [/\bMissions\b/g, 'Projects'],
  [/\bmissions\b/g, 'projects'],
  [/\bMission\b/g, 'Project'],
  [/\bmission\b/g, 'project'],
  [/\bAgent [1-7]\b/g, 'CariForge'],
];

/** "Gate 2" (zero-based) → "Step 3". */
const GATE_NUMBER = /\bGate (\d)\b/g;

/** Rewrite free-text copy that arrived from the API into user-facing terms. */
export function humaniseCopy(text: string): string {
  let out = text.replace(GATE_NUMBER, (_m, n: string) => {
    const idx = Number(n);
    return Number.isInteger(idx) && idx >= 0 && idx < StageNameValues.length
      ? `Step ${idx + 1}`
      : `Step ${n}`;
  });
  // Stage enum names that leak into server-authored titles ("SoftwareBuild gate").
  for (const stage of StageNameValues) {
    out = out.replace(new RegExp(`\\b${stage}\\b`, 'g'), STAGE_UI[stage].title);
  }
  out = out.replace(/\bGate\b/g, 'Approval').replace(/\bgate\b/g, 'approval');
  for (const [re, replacement] of TERM_MAP) out = out.replace(re, replacement);
  return out;
}

/** `EvidenceRequested` → "Evidence requested" for any enum we have no explicit map for. */
export function humanise(value: string): string {
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// === Output wording ==========================================================

/** Step 8 of the brief: what step 5 actually produces. Never "deployable build". */
export const PROTOTYPE_PACKAGE = 'approved runnable prototype package';
export const PROTOTYPE_PACKAGE_CONTENTS =
  'a runnable prototype, the Project plan, the Operating guide and an evidence receipt';
export const PROTOTYPE_BOUNDARY =
  'This is a prototype package for review, not a production deployment. Putting it into production is a separate, later decision made by your own team.';
