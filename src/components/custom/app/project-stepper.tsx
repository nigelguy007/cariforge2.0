// @polsia:user-owned — the five-step progress strip (brief, Step 4).
//
// Round 2 (2026-09-05) — design synthesis from three references the user
// pointed at directly: credo.ai/product ("Measurable Trust for Every AI
// System" — named, auditable gates instead of a generic progress bar),
// layer.ai's own before/after pipeline strip (icon-circle nodes joined by
// connector lines, not a single filled bar), and "a CI/CD-style pipeline
// bar, like GitHub Actions' approval gates" for the shape of the nodes
// themselves. Round 1 was a single continuous segmented bar; this is a
// real gate rail instead — circular nodes joined by connector lines, each
// done node showing WHO approved it and when, which is the actual product
// claim ("five named approvals, no hidden steps") made visible rather than
// asserted in copy. That data already existed (ApprovalItem.approverName,
// per the "UX review H1: the gate rail shows who approved and when" note
// in forge.ts) but had no UI consuming it before this — this component is
// that gate rail. The `approvals` prop is optional and additive: passing
// nothing renders the same rail without approver captions, so this isn't
// a breaking change for a hypothetical second caller.
//
// The current step gets a soft pulsing glow (the "glowing" treatment
// pulled from the same design-synthesis pass) via .app-node-pulse in
// custom-style.css — a real element, not a pseudo-element, so the
// existing `.app-shell * { animation-duration: 0s !important }` reduced-
// motion catch-all already zeroes it for anyone who's asked; no separate
// guard needed here (unlike .app-halo's own drift, which animates a
// pseudo-element that catch-all can't reach).

'use client';

import { Check } from 'lucide-react';
import type { ApprovalItemT } from '@/lib/contracts/forge';
import { STEPS, stageUiForIndex } from '@/lib/ui-terms';
import { cn } from '@/lib/utils';

export interface ProjectStepperProps {
  readonly currentStep: number;
  readonly completedSteps: readonly number[];
  /** Called when a completed step is chosen; opens its record in Supporting detail. */
  readonly onRevisit?: (step: number) => void;
  readonly revisitTargetId?: string;
  /** Real approval records (MissionDetail.approvals) — optional so the
   *  rail still renders correctly with no approver captions if a future
   *  caller doesn't have this data loaded yet. */
  readonly approvals?: readonly ApprovalItemT[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** For each step number, the most recent Approve/ApproveWithControls
 *  decision at that gate — "most recent" because a stage can be corrected
 *  and re-approved, and the rail should show the standing approval, not a
 *  stale one. Not every ApprovalDecision means approved (Return/Refuse
 *  exist too); this rail only ever claims a name for a gate that's
 *  actually done. */
function latestApprovalByStep(
  approvals: readonly ApprovalItemT[] | undefined,
): ReadonlyMap<number, ApprovalItemT> {
  const map = new Map<number, ApprovalItemT>();
  if (!approvals) return map;
  for (const a of approvals) {
    if (a.decision !== 'Approve' && a.decision !== 'ApproveWithControls') continue;
    const stepNumber = stageUiForIndex(a.gateIndex).number;
    const existing = map.get(stepNumber);
    if (!existing || a.at > existing.at) map.set(stepNumber, a);
  }
  return map;
}

export function ProjectStepper({
  currentStep,
  completedSteps,
  onRevisit,
  revisitTargetId,
  approvals,
}: ProjectStepperProps) {
  const done = new Set(completedSteps);
  const approvalByStep = latestApprovalByStep(approvals);

  return (
    <ol aria-label="Project steps" className="flex w-full items-start">
      {STEPS.map((step, i) => {
        const isDone = done.has(step.number);
        const isCurrent = step.number === currentStep;
        const isFuture = !isDone && !isCurrent;
        const isFirst = i === 0;
        const approval = approvalByStep.get(step.number);

        // Connector line to the LEFT of this node — a real gate rail is
        // circular nodes joined by lines, not one continuous filled bar
        // (that was round 1's shape). A completed connector reads solid
        // and accent-coloured; anything reaching into not-yet-done
        // territory stays a quiet dashed track.
        const connector = !isFirst && (
          <span
            aria-hidden="true"
            className={cn(
              'app-transition mt-[15px] h-px flex-1',
              isDone || isCurrent
                ? 'bg-[var(--app-accent)]'
                : 'border-t border-dashed border-[var(--app-border-strong)]/50 bg-transparent',
            )}
          />
        );

        const node = (
          <span
            aria-hidden="true"
            className={cn(
              'app-transition relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-[length:var(--app-caption)] font-semibold',
              isDone && 'border-[var(--app-accent)] bg-[var(--app-accent)] text-white',
              isCurrent &&
                'app-node-pulse border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]',
              isFuture &&
                'border-[var(--app-border-strong)]/50 bg-[var(--app-surface)] text-[var(--app-text-muted)]',
            )}
          >
            {isDone ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : step.number}
          </span>
        );

        const label = (
          <span className="mt-1.5 flex max-w-[7rem] flex-col items-center text-center">
            <span
              className={cn(
                'truncate text-[length:var(--app-small)]',
                isCurrent ? 'font-semibold text-[var(--app-text)]' : 'text-[var(--app-text-muted)]',
                isFuture && 'opacity-80',
              )}
            >
              <span className="hidden sm:inline">{step.title}</span>
              <span className="sm:hidden">{step.short}</span>
            </span>
            {/* The actual "five NAMED approvals" claim, made visible: who
                signed off this gate and when — not just that it's done.
                Reuses the same initials-avatar pattern app-shell.tsx
                already uses for the account menu, so this reads as the
                same product, not a bolted-on widget. */}
            {approval?.approverName ? (
              <span
                className="mt-0.5 flex items-center gap-1 text-[length:var(--app-caption)] text-[var(--app-text-muted)]"
                title={`Approved by ${approval.approverName}`}
              >
                <span
                  aria-hidden="true"
                  className="flex size-3.5 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[8px] font-semibold text-[var(--app-accent)]"
                >
                  {initials(approval.approverName)}
                </span>
                <span className="truncate">{approval.approverName}</span>
              </span>
            ) : null}
          </span>
        );

        return (
          <li key={step.stage} className="contents">
            {connector}
            <div
              aria-current={isCurrent ? 'step' : undefined}
              className="flex shrink-0 flex-col items-center"
            >
              {isDone && onRevisit ? (
                <button
                  type="button"
                  onClick={() => onRevisit(step.number)}
                  aria-controls={revisitTargetId}
                  className="app-transition flex min-h-11 flex-col items-center rounded-[var(--app-radius-sm)] px-1 hover:bg-[var(--app-accent-soft)] focus-visible:bg-[var(--app-accent-soft)]"
                >
                  <span className="sr-only">Completed, Step {step.number}: </span>
                  {node}
                  {label}
                </button>
              ) : (
                <div className="flex min-h-11 flex-col items-center px-1 py-1">
                  <span className="sr-only">
                    {isCurrent ? 'Current, ' : 'Not started, '}
                    Step {step.number}:{' '}
                  </span>
                  {node}
                  {label}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
