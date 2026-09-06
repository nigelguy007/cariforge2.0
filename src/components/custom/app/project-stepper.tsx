// @polsia:user-owned — the five-step progress strip (brief, Step 4). This is
// the one memorable element on the project page: a single continuous
// segmented bar, one segment per step. A completed segment is fully filled
// and can be revisited; the current segment gets a lighter in-progress fill
// plus a ring so it reads at a glance even without color; future segments
// are an empty/outline track. Steps are always numbered 1–5.

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
    <ol aria-label="Project steps" className="flex w-full items-start">
      {STEPS.map((step, i) => {
        const isDone = done.has(step.number);
        const isCurrent = step.number === currentStep;
        const isFuture = !isDone && !isCurrent;
        const isFirst = i === 0;
        const isLast = i === STEPS.length - 1;

        // The visible fill for this step's slice of the one continuous bar.
        const segment = (
          <span
            aria-hidden="true"
            className={cn(
              'app-transition block h-2.5 w-full',
              isFirst && 'rounded-l-full',
              isLast && 'rounded-r-full',
              isDone && 'bg-[var(--app-accent)]',
              isCurrent && 'bg-[var(--app-accent-soft)] ring-1 ring-inset ring-[var(--app-accent)]',
              isFuture && 'bg-[var(--app-border-strong)]/30',
            )}
          />
        );

        const label = (
          <span
            className={cn(
              'mt-1.5 flex w-full items-center gap-1 truncate text-[length:var(--app-small)]',
              isCurrent ? 'font-semibold text-[var(--app-text)]' : 'text-[var(--app-text-muted)]',
              isFuture && 'opacity-80',
            )}
          >
            <span className="sr-only">
              {isDone ? 'Completed, ' : isCurrent ? 'Current, ' : 'Not started, '}
              Step {step.number}:{' '}
            </span>
            {isDone ? (
              <Check
                aria-hidden="true"
                className="size-3 shrink-0 text-[var(--app-accent)]"
                strokeWidth={3}
              />
            ) : null}
            <span className="hidden truncate sm:inline">{step.title}</span>
            <span className="truncate sm:hidden">{step.short}</span>
          </span>
        );

        return (
          <li
            key={step.stage}
            aria-current={isCurrent ? 'step' : undefined}
            className="min-w-0 flex-1"
          >
            {isDone && onRevisit ? (
              <button
                type="button"
                onClick={() => onRevisit(step.number)}
                aria-controls={revisitTargetId}
                className="app-transition flex min-h-11 w-full flex-col items-start py-1 text-left hover:bg-[var(--app-accent-soft)] focus-visible:bg-[var(--app-accent-soft)]"
              >
                {segment}
                {label}
              </button>
            ) : (
              <div className="flex min-h-11 w-full flex-col items-start py-1">
                {segment}
                {label}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
