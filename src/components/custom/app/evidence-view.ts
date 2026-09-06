// @polsia:user-owned — the Evidence view model (brief, Step 5). Turns one
// project's real records into the five questions a buyer or auditor asks,
// plus at most three measures. Pure: no fetch, no React, unit-testable.
// Every fact here traces to a row the API already returns; nothing is
// invented and internal enums are translated at the edge.

import type {
  ApprovalItemT,
  GateStateT,
  MissionAuditItemT,
  MissionDetailT,
  ObjectionItemT,
} from '@/lib/contracts/forge';
import { StageNameValues } from '@/lib/contracts/forge';
import type { DocumentSpec } from '@/lib/pdf/schema';
import {
  DECISION_UI,
  humanise,
  humaniseCopy,
  PROTOTYPE_PACKAGE,
  REASON_UI,
  stageUiForIndex,
} from '@/lib/ui-terms';

export interface EvidenceMeasure {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export interface EvidenceFact {
  /** Stable, unique within its question — a React key, never the label
   *  (several facts can legitimately share a label, e.g. two "Step
   *  approved" audit rows or two conditions set at the same step). */
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** Optional second line — who / when. */
  readonly meta?: string;
}

export type EvidenceQuestionKey = 'why' | 'who' | 'what-used' | 'may-do' | 'changed';

export interface EvidenceQuestion {
  readonly key: EvidenceQuestionKey;
  readonly question: string;
  /** One line shown while the question is collapsed. */
  readonly summary: string;
  readonly facts: readonly EvidenceFact[];
  /** Shown when there is nothing recorded yet, instead of an empty list. */
  readonly empty: string;
}

export interface EvidenceView {
  readonly project: { readonly id: string; readonly slug: string; readonly name: string };
  readonly measures: readonly EvidenceMeasure[];
  readonly questions: readonly EvidenceQuestion[];
  readonly decisionCount: number;
  readonly lastRecordedAt: string | null;
  // Real user report (2026-09-05): "it says the project is completed but
  // i dont see any build or solution .. just a plan" — the PDF export's
  // closing note unconditionally claimed "This is an approved, finished,
  // ready-to-use solution package" regardless of how far the mission had
  // actually gotten. This mission's own evidence record showed decision
  // coverage 4 of 5 and 3 unresolved concerns at the very same time — the
  // note was flatly false. next-action-card.tsx already gates this exact
  // sentence correctly (only for a genuinely 'Complete'/'Released'
  // mission, see its PROTOTYPE_PACKAGE usage) — this brings the export in
  // line with that, instead of asserting completion unconditionally.
  readonly isComplete: boolean;
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function payloadText(payload: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

// --- measures ---------------------------------------------------------------

function decisionCoverage(gates: readonly GateStateT[], currentStageIndex: number) {
  const approved = gates.filter((g) => g.state === 'Approved').length;
  const total = StageNameValues.length;
  const reached = Math.min(currentStageIndex + 1, total);
  return {
    label: 'Decision coverage',
    value: `${approved} of ${total}`,
    detail:
      approved === total
        ? 'Every step has a named, recorded approval.'
        : `${plural(approved, 'step')} approved by a named person; ${plural(Math.max(reached - approved, 0), 'step')} reached but not yet approved.`,
  } satisfies EvidenceMeasure;
}

function checksPassed(workItems: MissionDetailT['workItems']) {
  const live = workItems.filter((w) => w.supersededById === null);
  const passed = live.filter((w) => w.status === 'Passed').length;
  if (live.length === 0) {
    return {
      label: 'Checks passed',
      value: '—',
      detail: 'No tasks with acceptance checks have been raised yet.',
    } satisfies EvidenceMeasure;
  }
  const failed = live.filter((w) => w.status === 'Failed').length;
  return {
    label: 'Checks passed',
    value: `${passed} of ${live.length}`,
    detail:
      failed > 0
        ? `${plural(failed, 'task')} failed its acceptance check and needs rework.`
        : passed === live.length
          ? 'Every task met its acceptance criteria.'
          : `${plural(live.length - passed, 'task')} still in progress or under test.`,
  } satisfies EvidenceMeasure;
}

function unresolvedConcerns(objections: readonly ObjectionItemT[]) {
  const open = objections.filter((o) => o.resolution === null).length;
  const carried = objections.filter((o) => o.resolution === 'CarriedForward').length;
  return {
    label: 'Unresolved concerns',
    value: String(open),
    detail:
      open === 0 && carried === 0
        ? objections.length === 0
          ? 'No concerns have been raised.'
          : 'Every concern raised has been answered.'
        : carried > 0
          ? `${plural(open, 'concern')} open; ${carried} carried forward with the dissent on record.`
          : `${plural(open, 'concern')} waiting for an answer.`,
  } satisfies EvidenceMeasure;
}

// --- questions --------------------------------------------------------------

function whyQuestion(detail: MissionDetailT): EvidenceQuestion {
  const { mission, handoffs } = detail;
  const need = handoffs
    .filter((h) => h.stage === 'Discovery' && h.supersededById === null)
    .sort((a, b) => b.version - a.version)[0];
  const facts: EvidenceFact[] = [
    {
      id: 'need-stated',
      label: 'The need, as stated',
      value: mission.intake,
      meta: `Recorded ${when(mission.createdAt)}`,
    },
  ];
  if (mission.normalizedNeed.trim().length > 0 && mission.normalizedNeed !== mission.intake) {
    facts.push({
      id: 'need-confirmed',
      label: 'The need, as confirmed',
      value: mission.normalizedNeed,
    });
  }
  const problem = need ? payloadText(need.payload, ['problemStatement', 'summary', 'need']) : null;
  if (problem && need) {
    facts.push({
      id: 'problem-statement',
      label: 'Problem statement',
      value: humaniseCopy(problem),
      meta: `Step 1 output, version ${need.version}`,
    });
  }
  return {
    key: 'why',
    question: 'Why does this project exist?',
    summary: mission.normalizedNeed.trim() || mission.intake,
    facts,
    empty: 'The need has not been recorded yet.',
  };
}

function approvalFact(a: ApprovalItemT): EvidenceFact {
  const step = stageUiForIndex(a.gateIndex);
  const who = a.approverName ?? 'A named approver';
  const controls = a.controls ? ` Conditions: ${a.controls}` : '';
  return {
    id: a.id,
    label: `Step ${step.number} · ${step.title}`,
    value: `${DECISION_UI[a.decision]} — ${a.reasonText}${controls}`,
    meta: `${who} · ${REASON_UI[a.reasonCode]} · ${when(a.at)}`,
  };
}

function whoQuestion(detail: MissionDetailT): EvidenceQuestion {
  const current = detail.approvals
    .filter((a) => !detail.approvals.some((b) => b.supersedesApprovalId === a.id))
    .sort((a, b) => a.gateIndex - b.gateIndex || a.at.localeCompare(b.at));
  const named = current.filter((a) => a.approverName || a.approverUserId).length;
  const attested = current.reduce((n, a) => n + a.attesterUserIds.length, 0);
  const reviewerLine = attested > 0 ? ` · ${plural(attested, 'specialist review')}` : '';
  return {
    key: 'who',
    question: 'Who approved each decision?',
    summary:
      current.length === 0
        ? 'No decisions recorded yet'
        : `${plural(current.length, 'decision')}, ${named} with a named approver${reviewerLine}`,
    facts: current.map(approvalFact),
    empty: 'No decisions have been recorded yet. Each one will show who made it and why.',
  };
}

function whatUsedQuestion(detail: MissionDetailT): EvidenceQuestion {
  const facts: EvidenceFact[] = detail.evidence
    .slice()
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((e) => ({
      id: e.id,
      label: e.label,
      value: e.ref,
      meta: `${humanise(e.kind)} · Captured ${when(e.capturedAt)}`,
    }));
  const readiness = detail.handoffs
    .filter((h) => h.stage === 'Readiness' && h.supersededById === null)
    .sort((a, b) => b.version - a.version)[0];
  const missing = readiness?.missingEvidence ?? [];
  if (missing.length > 0) {
    facts.push({
      id: 'missing-evidence',
      label: 'Still missing',
      value: missing.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('; '),
      meta: 'Named at Step 2 · Check readiness',
    });
  }
  return {
    key: 'what-used',
    question: 'What information was used?',
    summary:
      detail.evidence.length === 0
        ? 'No source evidence attached yet'
        : `${plural(detail.evidence.length, 'source')} on record${missing.length > 0 ? ` · ${plural(missing.length, 'gap')} named` : ''}`,
    facts,
    empty: 'No source evidence has been attached yet.',
  };
}

function mayDoQuestion(detail: MissionDetailT): EvidenceQuestion {
  const governance = detail.handoffs
    .filter((h) => h.stage === 'Governance' && h.supersededById === null)
    .sort((a, b) => b.version - a.version)[0];
  const softwareBuild = detail.handoffs
    .filter((h) => h.stage === 'SoftwareBuild' && h.supersededById === null)
    .sort((a, b) => b.version - a.version)[0];
  const facts: EvidenceFact[] = [];
  // Real user report (2026-09-05): "i dont see any build or solution ..
  // just a plan" — surface the actual generated files here, the same
  // place a buyer/auditor asks "what may the solution do", rather than
  // leaving them only visible on the project workspace's Agent activity
  // panel (see mission-generated-files.tsx / ai-draft.ts's
  // draftSoftwareBuildFiles). Untyped JSON from the DB, so only a
  // well-formed {path,content}[] counts.
  const files = Array.isArray(softwareBuild?.payload.files)
    ? (softwareBuild.payload.files as unknown[]).filter(
        (f): f is { path: string } =>
          typeof f === 'object' &&
          f !== null &&
          typeof (f as Record<string, unknown>).path === 'string',
      )
    : [];
  if (files.length > 0) {
    facts.push({
      id: 'generated-files',
      label: 'Files generated',
      value: files.map((f) => f.path).join(', '),
      meta: `${plural(files.length, 'file')} in the Software Build step output — see the project page to view or copy each one`,
    });
  }
  if (governance) {
    const decision = payloadText(governance.payload, ['decisionControl', 'humanCheckpoint']);
    const data = payloadText(governance.payload, ['dataControl', 'dataAccess']);
    const retention = payloadText(governance.payload, ['evidenceRetention', 'retention']);
    if (decision)
      facts.push({
        id: 'may-decisions',
        label: 'Decisions it may take',
        value: humaniseCopy(decision),
      });
    if (data) facts.push({ id: 'may-data', label: 'Data it may touch', value: humaniseCopy(data) });
    if (retention)
      facts.push({
        id: 'may-retention',
        label: 'How long evidence is kept',
        value: humaniseCopy(retention),
      });
  }
  const approvedTools = detail.toolActions.filter((t) => t.decision === 'Approved');
  if (approvedTools.length > 0) {
    facts.push({
      id: 'approved-actions',
      label: 'Approved actions',
      value: approvedTools.map((t) => `${humanise(t.tool)} (${humanise(t.scope)})`).join('; '),
      meta: `${plural(approvedTools.length, 'action')} approved by a person before running`,
    });
  }
  // Only the current (non-superseded) approve-with-controls decisions —
  // mirrors whoQuestion's own filter, so a re-approved gate doesn't show
  // conditions that no longer hold.
  const withConditions = detail.approvals.filter(
    (a) =>
      a.decision === 'ApproveWithControls' &&
      !detail.approvals.some((b) => b.supersedesApprovalId === a.id),
  );
  for (const a of withConditions) {
    if (a.controls) {
      facts.push({
        id: `condition-${a.id}`,
        label: `Conditions set at Step ${stageUiForIndex(a.gateIndex).number}`,
        value: a.controls,
        meta: `${a.approverName ?? 'Approver'} · ${when(a.at)}`,
      });
    }
  }
  const isComplete = detail.mission.status === 'Completed';
  facts.push({
    id: 'production-boundary',
    label: 'Production boundary',
    value: isComplete
      ? `The output is ${PROTOTYPE_PACKAGE} for review. Nothing here is deployed to production; that is a separate, later decision by your own team.`
      : 'This project has not been approved yet, so there is no finished output to describe here. Once every step is approved, this will describe what the completed package may do — until then, see Decision coverage and Unresolved concerns above for what is still outstanding.',
  });
  return {
    key: 'may-do',
    question: 'What may the solution do?',
    summary: governance
      ? `Controls set at Step 4${withConditions.length > 0 ? ` · ${plural(withConditions.length, 'condition')} attached` : ''}`
      : 'Controls not set yet',
    facts,
    empty: 'Controls are set at Step 4 and recorded here.',
  };
}

const CHANGE_EVENTS: Readonly<Record<string, string>> = {
  MissionCreated: 'Project started',
  HandoffCreated: 'Step output prepared',
  HandoffSuperseded: 'Step output replaced by a newer version',
  UserCorrection: 'Corrected by the project owner',
  ReplayRequested: 'Run again from a step',
  Replayed: 'Run again from a step',
  Rollback: 'Earlier version restored',
  RolledBack: 'Earlier version restored',
  MissionPaused: 'Paused',
  MissionResumed: 'Resumed',
  GateApproved: 'Step approved',
  GateReturned: 'Changes requested',
  GateRefused: 'Project stopped',
  ObjectionRaised: 'Concern raised',
  ObjectionResolved: 'Concern answered',
};

function changeLabel(event: string): string {
  return CHANGE_EVENTS[event] ?? humaniseCopy(humanise(event));
}

function changeMeta(entry: MissionAuditItemT): string {
  const reason = payloadText(entry.payload, ['reasonText', 'reason', 'note']);
  return [when(entry.at), reason ? humaniseCopy(reason) : null].filter(Boolean).join(' · ');
}

function changedQuestion(detail: MissionDetailT): EvidenceQuestion {
  const corrections = detail.handoffs.filter((h) => h.correctionOfId !== null).length;
  const replays = detail.handoffs.filter((h) => h.replayOfMissionId !== null).length;
  const superseded = detail.handoffs.filter((h) => h.supersededById !== null).length;
  const events = detail.audits
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12)
    .map((e) => ({
      id: e.id,
      label: changeLabel(e.event),
      value: changeMeta(e) || when(e.at),
      meta: `Version ${e.missionVersionAtEvent}`,
    }));
  const parts = [
    corrections > 0 ? plural(corrections, 'correction') : null,
    replays > 0 ? `${replays} run again` : null,
    superseded > 0 ? `${superseded} superseded` : null,
    detail.mission.rolledBackAt ? 'earlier version restored' : null,
  ].filter(Boolean);
  return {
    key: 'changed',
    question: 'What changed, and why?',
    summary:
      parts.length > 0
        ? parts.join(' · ')
        : `${plural(detail.audits.length, 'recorded event')} · no corrections`,
    facts: events,
    empty: 'Nothing has changed yet.',
  };
}

// --- entry point ------------------------------------------------------------

export function buildEvidenceView(detail: MissionDetailT): EvidenceView {
  const { mission } = detail;
  const lastRecordedAt = detail.audits.reduce<string | null>(
    (latest, a) => (latest === null || a.at > latest ? a.at : latest),
    null,
  );
  return {
    project: { id: mission.id, slug: mission.slug, name: mission.name },
    measures: [
      decisionCoverage(detail.gates, mission.currentStageIndex),
      checksPassed(detail.workItems),
      unresolvedConcerns(detail.objections),
    ],
    questions: [
      whyQuestion(detail),
      whoQuestion(detail),
      whatUsedQuestion(detail),
      mayDoQuestion(detail),
      changedQuestion(detail),
    ],
    decisionCount: detail.approvals.length,
    lastRecordedAt,
    isComplete: mission.status === 'Completed',
  };
}

/** Plain-language line for an Evidence index row. */
export function evidenceIndexLine(currentStageIndex: number): string {
  const step = stageUiForIndex(currentStageIndex);
  return `At Step ${step.number}, ${step.title.toLowerCase()}`;
}

// --- PDF export ---------------------------------------------------------
// DocumentSpec (src/lib/pdf/schema.ts) is invoice-shaped — title/subtitle,
// label/value meta rows, one free-text notes block — so the five questions
// become meta rows (label = the question, value = the summary plus its
// facts) rather than a bespoke layout. Pure and testable without pdf-lib.

function factLine(fact: EvidenceFact): string {
  return fact.meta ? `${fact.label}: ${fact.value} (${fact.meta})` : `${fact.label}: ${fact.value}`;
}

function questionValue(q: EvidenceQuestion): string {
  if (q.facts.length === 0) return q.empty;
  return [q.summary, ...q.facts.map(factLine)].join('. ');
}

/** Renders the same record as the page — for the "Evidence record (PDF)" export. */
export function evidenceViewToDocumentSpec(view: EvidenceView): DocumentSpec {
  return {
    title: view.project.name,
    subtitle: 'Evidence record — decision coverage, checks passed and unresolved concerns',
    meta: [
      ...view.measures.map((m) => ({ label: m.label, value: `${m.value} — ${m.detail}` })),
      ...view.questions.map((q) => ({ label: q.question, value: questionValue(q) })),
    ],
    notes: view.isComplete
      ? `This is ${PROTOTYPE_PACKAGE}: with its Project plan, Operating guide and this evidence ` +
        "receipt — not a production deployment. Verify this record's hash chain in the app " +
        'before relying on it.'
      : 'This project has not been approved yet — this record shows progress so far, not a ' +
        'finished solution package. See Decision coverage and Unresolved concerns above for ' +
        "what is still outstanding. Verify this record's hash chain in the app before relying " +
        'on it.',
    footer: `Generated ${new Date().toLocaleString()}.`,
  };
}
