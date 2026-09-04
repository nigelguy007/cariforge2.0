// @polsia:user-owned — the five-step progress strip (brief, Step 4). This is
// the one memorable element on the project page: completed steps show a
// check and can be revisited, the current step carries the brand accent,
// future steps are quiet and not openable. Steps are always numbered 1–5.

'use client';

import { Check } from 'lucide-react';
import { STEPS } from '@/lib/ui-terms';
import { cn } from '@/lib/utils';

export interface ProjectStepperProps {
  readonly currentStep: number;
  readonly completedSteps: readonly number[];
  /** Called when a completed step is chosen; opens its record in Supporting detail. */
  readonly onRevisit?: (step: number) => void;
  readonly revisitTargetId?: string;
}

export function ProjectStepper({
  currentStep,
  completedSteps,
  onRevisit,
  revisitTargetId,
}: ProjectStepperProps) {
  const done = new Set(completedSteps);
  return (
    <ol aria-label="Project steps" className="flex w-full items-start gap-1 sm:gap-2">
      {STEPS.map((step, i) => {
        const isDone = done.has(step.number);
        const isCurrent = step.number === currentStep;
        const isFuture = !isDone && !isCurrent;
        const label = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                'app-transition flex size-6 shrink-0 items-center justify-center rounded-full border text-[length:var(--app-caption)] font-semibold',
                isDone && 'border-[var(--app-accent)] bg-[var(--app-accent)] text-white',
                isCurrent &&
                  'border-[var(--app-accent)] bg-[var(--app-surface)] text-[var(--app-accent-strong)] ring-2 ring-[var(--app-accent-soft)]',
                isFuture &&
                  'border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-text-muted)]',
              )}
            >
              {isDone ? <Check className="size-3.5" strokeWidth={3} /> : step.number}
            </span>
            <span
              className={cn(
                'truncate text-[length:var(--app-small)]',
                isCurrent ? 'font-semibold text-[var(--app-text)]' : 'text-[var(--app-text-muted)]',
                isFuture && 'opacity-80',
              )}
            >
              <span className="sr-only">
                {isDone ? 'Completed, ' : isCurrent ? 'Current, ' : 'Not started, '}
                Step {step.number}:{' '}
              </span>
              <span className="hidden sm:inline">{step.title}</span>
              <span className="sm:hidden">{step.short}</span>
            </span>
          </>
        );

        return (
          <li
            key={step.stage}
            aria-current={isCurrent ? 'step' : undefined}
            className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2"
          >
            {isDone && onRevisit ? (
              <button
                type="button"
                onClick={() => onRevisit(step.number)}
                aria-controls={revisitTargetId}
                className="app-transition flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[var(--app-radius-sm)] px-1 text-left hover:bg-[var(--app-accent-soft)]"
              >
                {label}
              </button>
            ) : (
              <span className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-1">{label}</span>
            )}
            {i < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'h-px w-3 shrink-0 sm:w-6',
                  isDone ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border-strong)]',
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
