// @polsia:user-owned — the one visible next action (brief, Step 4).
//
// Maps the existing next-action view to a single sentence and at most one
// solid button. A formal approval opens DecisionDialog; every other kind
// (a concern to resolve, a requested action to decide, pause/resume/run
// again, a task to assign) opens the matching section of Supporting detail
// where the existing governance component does the work. Terminal states
// say what was produced — an approved runnable prototype package — and
// never claim a production deployment.

'use client';

import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import type { MissionDetailT } from '@/lib/contracts/forge';
import { humaniseCopy, PROTOTYPE_PACKAGE, STAGE_UI, stepNumberLabel } from '@/lib/ui-terms';
import { DecisionDialog } from './decision-dialog';
import type { DetailSection } from './supporting-detail';
import type { ProjectWorkspaceView } from './use-project-workspace';

export interface NextActionCardProps {
  readonly view: ProjectWorkspaceView;
  readonly detail: MissionDetailT;
  readonly onWritten: () => Promise<void> | void;
  readonly onOpenSection: (section: DetailSection) => void;
  readonly detailId: string;
}

interface Plan {
  readonly heading: string;
  readonly sentence: string;
  readonly button?: { label: string; section?: DetailSection; opensDialog?: boolean };
}

function planFor(view: ProjectWorkspaceView): Plan {
  const action = view.nextAction.view;
  switch (action.kind) {
    case 'ApproveGate': {
      const step = STAGE_UI[action.stage];
      const gate = view.currentGate;
      if (!gate?.currentStageHandoffId) {
        return {
          heading: step.title,
          sentence:
            'CariForge has not produced a step output for this step yet, so there is nothing to approve. Add one, or wait for it to arrive.',
          button: { label: 'Add the step output', section: 'outputs' },
        };
      }
      return {
        heading: step.title,
        sentence: humaniseCopy(action.rationale),
        button: { label: step.action, opensDialog: true },
      };
    }
    case 'ResolveObjection':
      return {
        heading: 'A concern needs your answer',
        sentence: humaniseCopy(action.rationale),
        button: { label: 'Answer the concern', section: 'concerns' },
      };
    case 'DecideToolAction':
      return {
        heading: 'A requested action needs your decision',
        sentence: humaniseCopy(action.rationale),
        button: { label: 'Review the requested action', section: 'actions' },
      };
    case 'Pause':
      return {
        heading: 'This project should pause',
        sentence: humaniseCopy(action.reason),
        button: { label: 'Pause this project', section: 'controls' },
      };
    case 'Resume':
      return {
        heading: 'This project is paused',
        sentence:
          'Resume it to pick up at the current step, or keep it paused until you are ready.',
        button: { label: 'Resume this project', section: 'controls' },
      };
    case 'Replay': {
      const label = `Run again from ${stepNumberLabel(action.fromStageIndex)}`;
      return {
        heading: label,
        sentence: humaniseCopy(action.title),
        button: { label, section: 'controls' },
      };
    }
    case 'ArrangeWorkItem':
      return {
        heading: 'A task needs an owner',
        sentence: humaniseCopy(action.title),
        button: { label: 'Assign the task', section: 'tasks' },
      };
    case 'Released':
    case 'Complete':
      return {
        heading: 'This project is complete',
        sentence: `The ${PROTOTYPE_PACKAGE} has been approved. It is a prototype with its Project plan, Operating guide and evidence receipt — not a production deployment.`,
      };
    default:
      return {
        heading: 'Nothing needs you right now',
        sentence:
          humaniseCopy(action.title) ||
          'CariForge will surface the next step here when there is one.',
      };
  }
}

export function NextActionCard({
  view,
  detail,
  onWritten,
  onOpenSection,
  detailId,
}: NextActionCardProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const plan = planFor(view);
  const action = view.nextAction.view;
  const blockers = view.nextAction.blockers;
  const isTerminal = view.nextAction.isTerminal;
  const gateForDialog =
    action.kind === 'ApproveGate'
      ? (detail.gates.find((g) => g.gateIndex === action.gateIndex) ?? null)
      : null;

  return (
    <section
      aria-labelledby="next-action-heading"
      className={plan.button ? 'app-panel-action' : 'app-panel'}
    >
      <p className="app-caption text-[var(--app-text-muted)]">
        {isTerminal ? 'Outcome' : 'Your next action'}
      </p>
      <h2 id="next-action-heading" className="app-h2 mt-1 text-[var(--app-text)]">
        {plan.heading}
      </h2>
      <p className="app-body mt-1.5 max-w-prose text-[var(--app-text-muted)]">{plan.sentence}</p>

      {blockers.length > 0 ? (
        <div
          className="mt-3 rounded-[var(--app-radius-sm)] border border-amber-300 bg-amber-50 px-3 py-2"
          aria-live="polite"
        >
          <p className="app-small font-medium text-amber-900">Before you can continue</p>
          <ul className="app-small mt-1 list-disc space-y-0.5 pl-5 text-amber-900">
            {blockers.map((b) => (
              <li key={b}>{humaniseCopy(b)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.button ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="min-h-11 px-5"
            aria-controls={plan.button.section ? detailId : undefined}
            onClick={() => {
              if (plan.button?.opensDialog) setDialogOpen(true);
              else if (plan.button?.section) onOpenSection(plan.button.section);
            }}
          >
            {plan.button.label}
          </Button>
          <Link href="/missions" className="app-link app-small inline-flex min-h-11 items-center">
            Save for later
          </Link>
        </div>
      ) : null}

      {action.kind === 'ApproveGate' && gateForDialog ? (
        <DecisionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          missionId={detail.mission.id}
          stage={action.stage}
          gate={gateForDialog}
          onDecided={onWritten}
        />
      ) : null}
    </section>
  );
}
