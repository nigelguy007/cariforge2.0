// @polsia:user-owned — the "Agent activity" checklist (brief, 2026-09-05
// architecture doc): a visible, always-collapsed-parent list of what each
// real step's agent has produced, built entirely from data that already
// exists (a non-superseded handoff per stage, real specialist attesters on
// the latest one, real objection resolutions). No stage is invented: only
// the five real stages this schema has are shown, never the doc's
// aspirational Partner/Impact agents.
// Extracted from supporting-detail.tsx (2026-09-05) to give it its own
// top-level, always-visible-but-collapsed section on the project workspace
// page instead of living inside the "Supporting detail" council group. The
// "Agent activity — N of N complete" header itself now lives on the
// section's own <details><summary> in project-workspace.tsx, so this
// component renders only the list and the council-review footer.

import { MissionGeneratedFiles } from '@/components/custom/missions/mission-generated-files';
import {
  GATE_DEFS,
  type MissionDetailT,
  SPECIALIST_ROLE_VALUES,
  type StageName,
} from '@/lib/contracts/forge';
import { AGENT_ACTIVITY_UI, DECISION_UI, humanise, reasonLabel, STEPS } from '@/lib/ui-terms';

// Generic: works for both an AI-drafted payload (known field names, see
// ai-draft.ts's StepDraftV4) and a human-typed one (arbitrary JSON) —
// shows whatever non-empty string/array fields exist, translated, rather
// than assuming one fixed shape.
function payloadFacts(
  payload: Record<string, unknown>,
): readonly { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  for (const [key, value] of Object.entries(payload)) {
    // 'files' (SoftwareBuild's generated code, see ai-draft.ts) is an
    // array of {path, content} objects, not strings — deliberately
    // excluded here (the string-array branch below already naturally
    // skips it, since none of its entries pass the `typeof v === 'string'`
    // filter) and rendered separately by MissionGeneratedFiles instead of
    // as a generic fact, since dumping file contents into one joined
    // line would be unreadable.
    if (key === 'files') continue;
    if (typeof value === 'string' && value.trim()) {
      facts.push({ label: humanise(key), value: value.trim() });
    } else if (Array.isArray(value) && value.length > 0) {
      const items = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
      if (items.length > 0) facts.push({ label: humanise(key), value: items.join('; ') });
    }
  }
  return facts;
}

/** Defensive extraction — payload is untyped JSON from the DB; only a
 *  well-formed {path, content}[] counts, anything else is treated as
 *  absent rather than rendered wrong. */
function generatedFilesFrom(payload: Record<string, unknown>): { path: string; content: string }[] {
  const raw = payload.files;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is { path: string; content: string } =>
      typeof f === 'object' &&
      f !== null &&
      typeof (f as Record<string, unknown>).path === 'string' &&
      typeof (f as Record<string, unknown>).content === 'string',
  );
}

/** "Selecting an agent reveals" (2026-09-05 architecture doc): what it was
 *  asked to do, what it produced, its confidence, concerns raised, and
 *  why the decision landed the way it did — all from data already on
 *  the mission, no new fetch. */
function AgentStepDetail({
  step,
  handoff,
  gate,
  approval,
  objections,
}: {
  step: (typeof STEPS)[number];
  handoff: MissionDetailT['handoffs'][number] | null;
  gate: MissionDetailT['gates'][number] | undefined;
  approval: MissionDetailT['approvals'][number] | undefined;
  objections: readonly MissionDetailT['objections'][number][];
}) {
  const gateDef = GATE_DEFS.find((g) => g.stage === step.stage);
  return (
    <div className="app-detail-body mt-2 space-y-2">
      <p className="app-caption text-[var(--app-text-muted)]">
        Asked to: {gateDef?.purpose ?? step.sentence}
      </p>
      {handoff ? (
        <>
          {payloadFacts(handoff.payload as Record<string, unknown>).map((f) => (
            <div key={f.label}>
              <p className="app-small font-medium text-[var(--app-text)]">{f.label}</p>
              <p className="app-small text-[var(--app-text-muted)]">{f.value}</p>
            </div>
          ))}
          <MissionGeneratedFiles
            files={generatedFilesFrom(handoff.payload as Record<string, unknown>)}
          />
          <p className="app-caption text-[var(--app-text-muted)]">
            Confidence: {Math.round(handoff.confidence * 100)}%
          </p>
        </>
      ) : null}
      {objections.length > 0 ? (
        <div>
          <p className="app-small font-medium text-[var(--app-text)]">Concerns raised</p>
          <ul className="mt-1 space-y-1">
            {objections.map((o) => (
              <li key={o.id} className="app-small text-[var(--app-text-muted)]">
                {o.raisedByRole}: {o.text}
                {o.resolution ? ' — resolved' : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {gate && approval ? (
        <p className="app-caption text-[var(--app-text-muted)]">
          {DECISION_UI[approval.decision]} by {approval.approverName ?? 'the approver'} —{' '}
          {reasonLabel(approval.reasonCode)}
        </p>
      ) : null}
    </div>
  );
}

/** Number of the five real stages that have a non-superseded step output —
 *  the "N of N complete" count shown on this panel's own collapsible
 *  section header (see project-workspace.tsx). */
export function agentActivityDoneCount(detail: MissionDetailT): number {
  return STEPS.filter((step) =>
    detail.handoffs.some((h) => h.stage === step.stage && h.supersededById === null),
  ).length;
}

export function AgentActivityPanel({
  detail,
  draftingStage = null,
}: {
  detail: MissionDetailT;
  // Real user report (2026-09-05): "nothing happening at all" / "why is
  // draft with ai button still avaioable" — this list used to render
  // purely from already-loaded `detail`, with zero signal while a Draft
  // with AI click was actually mid-flight (see next-action-card.tsx's
  // draftWithAi). When set, the matching stage's row shows "Working…"
  // live instead of "Not started yet", in sync with the button above it.
  draftingStage?: StageName | null;
}) {
  const latestHandoff = detail.handoffs.find((h) => h.supersededById === null) ?? null;
  const reviewCount = latestHandoff
    ? new Set(
        detail.handoffAttesters.filter((a) => a.handoffId === latestHandoff.id).map((a) => a.role),
      ).size
    : 0;
  const resolvedConcerns = detail.objections.filter((o) => o.resolution !== null).length;

  return (
    <div className="app-panel">
      <ul className="space-y-1">
        {STEPS.map((step) => {
          const handoff =
            detail.handoffs.find((h) => h.stage === step.stage && h.supersededById === null) ??
            null;
          const done = handoff !== null;
          const ui = AGENT_ACTIVITY_UI[step.stage];
          const gate = detail.gates.find((g) => g.gateIndex === STEPS.indexOf(step));
          const approval = detail.approvals
            .filter((a) => a.gateIndex === STEPS.indexOf(step))
            .sort((a, b) => b.at.localeCompare(a.at))[0];
          const objections = handoff
            ? detail.objections.filter((o) => o.stageHandoffId === handoff.id)
            : [];
          const working = !done && step.stage === draftingStage;
          return (
            <li key={step.stage}>
              <details className="app-disclosure">
                <summary className="flex min-h-9 items-baseline gap-2 app-small">
                  <span
                    aria-hidden="true"
                    className={
                      done
                        ? 'text-emerald-600'
                        : working
                          ? 'animate-pulse text-[var(--app-accent)]'
                          : 'text-[var(--app-text-muted)]'
                    }
                  >
                    {done ? '✓' : working ? '…' : '·'}
                  </span>
                  <span
                    className={
                      done || working ? 'text-[var(--app-text)]' : 'text-[var(--app-text-muted)]'
                    }
                  >
                    {ui.agent}
                  </span>
                  <span
                    className={
                      working
                        ? 'font-medium text-[var(--app-accent)]'
                        : 'text-[var(--app-text-muted)]'
                    }
                    aria-live={working ? 'polite' : undefined}
                  >
                    {done ? ui.done : working ? 'Working…' : 'Not started yet'}
                  </span>
                </summary>
                <AgentStepDetail
                  step={step}
                  handoff={handoff}
                  gate={gate}
                  approval={approval}
                  objections={objections}
                />
              </details>
            </li>
          );
        })}
      </ul>
      {latestHandoff ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-[var(--app-border)] pt-2">
            <p className="app-small font-medium text-[var(--app-text)]">Council review</p>
            <p className="app-small text-[var(--app-text-muted)]">
              {reviewCount} of {SPECIALIST_ROLE_VALUES.length} complete
            </p>
          </div>
          {resolvedConcerns > 0 ? (
            <p className="app-caption mt-1 text-[var(--app-text-muted)]">
              {resolvedConcerns} {resolvedConcerns === 1 ? 'concern' : 'concerns'} resolved
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
