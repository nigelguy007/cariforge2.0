// @polsia:user-owned — the one view model behind the project workspace
// (brief, Step 7). Fetches mission detail and the next action once, in
// parallel, and adapts them into ProjectWorkspaceView so the page never
// refetches per section. Everything shown on the page is derived here; the
// raw MissionDetail is still exposed for the reused governance components in
// Supporting detail.

'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  type GateStateT,
  type HandoffItemT,
  MissionDetail,
  type MissionDetailT,
  MissionList,
  NextActionResponse,
  type NextActionResponseT,
} from '@/lib/contracts/forge';
import { STEPS, type StepUi, stageUiForIndex } from '@/lib/ui-terms';

export interface SummaryItem {
  readonly label: string;
  readonly value: string;
}

export interface CouncilSummary {
  /** Specialist reviews signed on the latest step output. */
  readonly reviewsComplete: number;
  /** Council seats appointed on the project. */
  readonly seats: number;
  readonly concernsOpen: number;
  readonly concernsCarried: number;
}

export interface EvidenceSummary {
  readonly count: number;
  readonly latestAt: string | null;
}

export interface DecisionSummary {
  readonly count: number;
  readonly latestAt: string | null;
  /** Plain-language state of the decision record. */
  readonly state: 'Up to date' | 'Waiting for your decision' | 'No decisions yet';
}

export interface ProjectWorkspaceView {
  readonly project: MissionDetailT['mission'];
  readonly currentStep: StepUi;
  /** One-based step numbers that hold an approved decision. */
  readonly completedSteps: readonly number[];
  readonly summaryItems: readonly SummaryItem[];
  readonly nextAction: NextActionResponseT;
  readonly councilSummary: CouncilSummary;
  readonly evidenceSummary: EvidenceSummary;
  readonly decisionSummary: DecisionSummary;
  /** The gate the current step is waiting on, if any. */
  readonly currentGate: GateStateT | null;
  /** Latest non-superseded step output — what an approval is about. */
  readonly latestHandoff: HandoffItemT | null;
  /** Saved-state line for the header. */
  readonly savedAt: string;
}

export type ProjectWorkspaceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; view: ProjectWorkspaceView; detail: MissionDetailT };

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function clip(text: string, max = 160): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length > max ? `${single.slice(0, max - 1).trimEnd()}…` : single;
}

function pct(confidence: number | null | undefined): string | null {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return null;
  const value = confidence <= 1 ? confidence * 100 : confidence;
  return `${Math.round(value)}% confidence`;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** Pure adapter so it can be unit-tested without the network. */
export function buildProjectWorkspaceView(
  detail: MissionDetailT,
  nextAction: NextActionResponseT,
): ProjectWorkspaceView {
  const { mission } = detail;
  const currentStep = stageUiForIndex(mission.currentStageIndex);
  const latestHandoff =
    detail.handoffs.find((h) => !h.supersededById) ?? detail.handoffs[0] ?? null;

  const approvedGateIndexes = new Set(
    detail.gates.filter((g) => g.state === 'Approved').map((g) => g.gateIndex),
  );
  const completedSteps = STEPS.filter((_, i) => approvedGateIndexes.has(i)).map((s) => s.number);

  const currentGate =
    detail.gates.find((g) => g.gateIndex === mission.currentStageIndex && g.state !== 'Approved') ??
    null;

  // Prepared summary — at most three facts, all derived from data that
  // already exists on the project. Nothing here is invented.
  const items: SummaryItem[] = [];
  const need = mission.normalizedNeed?.trim() || mission.intake?.trim();
  if (need) items.push({ label: 'The need', value: clip(need) });
  if (latestHandoff) {
    const step = stageUiForIndex(STEPS.findIndex((s) => s.stage === latestHandoff.stage));
    const headline = firstString(latestHandoff.payload, [
      'summary',
      'headline',
      'title',
      'description',
      'objective',
      'need',
    ]);
    const confidence = pct(latestHandoff.confidence);
    const value = [
      headline ? clip(headline, 140) : `Version ${latestHandoff.version} is ready to review`,
      confidence,
    ]
      .filter(Boolean)
      .join(' · ');
    items.push({ label: `${step.title} — step output`, value });
  }
  const openConcerns = detail.objections.filter((o) => o.resolution === null).length;
  const carried = detail.objections.filter((o) => o.resolution === 'CarriedForward').length;
  if (items.length < 3) {
    const parts: string[] = [];
    if (openConcerns > 0) parts.push(plural(openConcerns, 'open concern'));
    if (carried > 0) parts.push(`${carried} carried forward`);
    if (latestHandoff && latestHandoff.missingEvidence.length > 0) {
      parts.push(
        `${plural(latestHandoff.missingEvidence.length, 'piece')} of evidence still missing`,
      );
    }
    if (parts.length > 0) items.push({ label: 'To be aware of', value: parts.join(' · ') });
    else if (detail.evidence.length > 0) {
      items.push({
        label: 'Evidence on file',
        value: `${plural(detail.evidence.length, 'item')} attached`,
      });
    }
  }

  const latestApproval = [...detail.approvals].sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
  const decisionSummary: DecisionSummary = {
    count: detail.approvals.length,
    latestAt: latestApproval?.at ?? null,
    state:
      nextAction.view.kind === 'ApproveGate'
        ? 'Waiting for your decision'
        : detail.approvals.length === 0
          ? 'No decisions yet'
          : 'Up to date',
  };

  const latestEvidence = [...detail.evidence].sort((a, b) =>
    b.capturedAt.localeCompare(a.capturedAt),
  )[0];

  const reviewsComplete = latestHandoff
    ? detail.handoffAttesters.filter((a) => a.handoffId === latestHandoff.id).length
    : 0;

  const savedAt =
    [mission.updatedAt, latestApproval?.at, latestHandoff?.createdAt]
      .filter((v): v is string => typeof v === 'string')
      .sort()
      .at(-1) ?? mission.updatedAt;

  return {
    project: mission,
    currentStep,
    completedSteps,
    summaryItems: items.slice(0, 3),
    nextAction,
    councilSummary: {
      reviewsComplete,
      seats: detail.oracleRoster.length,
      concernsOpen: openConcerns,
      concernsCarried: carried,
    },
    evidenceSummary: {
      count: detail.evidence.length,
      latestAt: latestEvidence?.capturedAt ?? null,
    },
    decisionSummary,
    currentGate,
    latestHandoff,
    savedAt,
  };
}

export function useProjectWorkspace(slug: string): {
  state: ProjectWorkspaceState;
  refresh: () => Promise<void>;
} {
  const [state, setState] = React.useState<ProjectWorkspaceState>({ status: 'loading' });
  const missionIdRef = React.useRef<string | null>(null);
  // Bumped on every load() call; a resolving fetch only commits state if it
  // is still the most recent request. Guards against a slug change or a
  // rapid refresh() firing while an earlier request is still in flight.
  const requestRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const generation = ++requestRef.current;
    try {
      let id = missionIdRef.current;
      if (!id) {
        const list = await apiFetch('/api/forge/missions', { schema: MissionList });
        if (generation !== requestRef.current) return;
        const found = list.items.find((it) => it.slug === slug);
        if (!found) {
          setState({
            status: 'error',
            message:
              'This project could not be found. It may have been renamed, or you may not have access to it.',
          });
          return;
        }
        id = found.id;
        missionIdRef.current = id;
      }
      const [detail, nextAction] = await Promise.all([
        apiFetch(`/api/forge/missions/${id}`, { schema: MissionDetail }),
        apiFetch(`/api/forge/missions/${id}/next-action`, { schema: NextActionResponse }),
      ]);
      if (generation !== requestRef.current) return;
      setState({ status: 'ready', detail, view: buildProjectWorkspaceView(detail, nextAction) });
    } catch (err) {
      if (generation !== requestRef.current) return;
      setState({
        status: 'error',
        message: apiErrorMessage(err, 'This project could not be loaded.'),
      });
    }
  }, [slug]);

  React.useEffect(() => {
    missionIdRef.current = null;
    setState({ status: 'loading' });
    void load();
  }, [load]);

  return { state, refresh: load };
}
