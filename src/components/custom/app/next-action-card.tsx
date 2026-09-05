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
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { useIsAdmin, useSession } from '@/lib/auth-client';
import { nextActionFor } from '@/lib/business/forge/next-action';
import { MissionDetail, type MissionDetailT } from '@/lib/contracts/forge';
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
  readonly button?: {
    label: string;
    section?: DetailSection;
    opensDialog?: boolean;
    draftWithAi?: boolean;
  };
}

function planFor(view: ProjectWorkspaceView, isAdmin: boolean, canDraft: boolean): Plan {
  const action = view.nextAction.view;
  switch (action.kind) {
    case 'ApproveGate': {
      const step = STAGE_UI[action.stage];
      const gate = view.currentGate;
      if (!gate?.currentStageHandoffId) {
        return {
          heading: step.title,
          sentence: canDraft
            ? 'CariForge has not produced a step output for this step yet. Have it draft one now — it will keep working through the following steps on its own for as long as it can, and only stop here for you when a step genuinely needs your judgment.'
            : 'CariForge has not produced a step output for this step yet, so there is nothing to approve yet. Check back soon.',
          button: canDraft ? { label: 'Draft with AI', draftWithAi: true } : undefined,
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
        sentence: isAdmin
          ? humaniseCopy(action.title)
          : 'A task on this project needs an owner assigned. This is arranged by the delivery team, not from this page.',
        button: isAdmin ? { label: 'Assign the task', section: 'tasks' } : undefined,
      };
    case 'Released':
    case 'Complete':
      return {
        heading: 'This project is complete',
        sentence: `The ${PROTOTYPE_PACKAGE} has been approved. It is a prototype with its Project plan, Operating guide and evidence receipt — not a production deployment.`,
      };
    // User-specified flow (2026-09-05): "If not approved by elder then
    // it's stops apologies and advises user rethink then comeback." A
    // refused gate (including an Elder's "no" on gate 0/4) is a real
    // ending, distinct from an actual completion — it gets its own
    // apologetic, forward-looking message instead of reusing "This
    // project is complete... has been approved", which was actively
    // wrong for a project that was turned down.
    case 'Closed':
      return action.status === 'Rejected'
        ? {
            heading: "We're sorry — this one didn't get approved",
            sentence:
              'The reviewers did not approve this project as submitted. Take another look at the concerns raised, rework the idea, and start a new project whenever you want to try again.',
          }
        : {
            heading: 'This project was stopped',
            sentence:
              'It was closed before completion. Start a new project whenever you want to pick the idea back up.',
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
  const [drafting, setDrafting] = React.useState(false);
  const [draftingStep, setDraftingStep] = React.useState<number | null>(null);
  const isAdmin = useIsAdmin();
  const { data: session } = useSession();
  // Matches submitHandoff's own server-side rule exactly (isAdmin OR the
  // mission's own creator) — the button only ever appears for someone the
  // API will actually let draft this step.
  const canDraft = isAdmin || detail.mission.createdById === session?.user?.id;
  const plan = planFor(view, isAdmin, canDraft);
  const action = view.nextAction.view;
  const blockers = view.nextAction.blockers;
  const isTerminal = view.nextAction.isTerminal;
  const gateForDialog =
    action.kind === 'ApproveGate'
      ? (detail.gates.find((g) => g.gateIndex === action.gateIndex) ?? null)
      : null;

  // User instruction (2026-09-05): "Draft with AI needs to be the start of
  // work by the agents. They then proceed to build and take user through
  // journey checking and moving to next stage in 5 agents all the way to
  // build." Before this, one click only ever drafted+reviewed ONE stage —
  // even a fully clean auto-advance left the person to come back and
  // click again for every remaining stage. Now one click chains straight
  // through every consecutive stage CariForge can clear on its own
  // (drafted, reviewed, auto-advanced with no concerns), stopping the
  // instant a stage genuinely needs a human: a concern to answer, low
  // confidence, or the project reaching a terminal state. nextActionFor
  // is the same pure function the server's own /next-action endpoint
  // uses — no guessing at the shape from the client side.
  const MAX_AUTO_STAGES = 5; // one loop iteration per real stage, hard cap against ever looping forever
  const draftWithAi = async () => {
    setDrafting(true);
    try {
      let stepsDrafted = 0;
      for (let i = 0; i < MAX_AUTO_STAGES; i++) {
        setDraftingStep(i + 1);
        const updated = await apiFetch(`/api/forge/missions/${detail.mission.id}/draft`, {
          method: 'POST',
          schema: MissionDetail,
        });
        stepsDrafted += 1;
        const nextView = nextActionFor({
          status: updated.mission.status,
          gates: updated.gates,
          approvals: updated.approvals,
          objections: updated.objections,
          toolActions: updated.toolActions.map((t) => ({
            id: t.id,
            decision: t.decision,
            tool: t.tool,
            scope: t.scope,
          })),
          workItems: updated.workItems ?? [],
        });
        // Only keep going if the mission auto-advanced straight into
        // ANOTHER gate with nothing drafted for it yet — anything else
        // (a concern, a low-confidence gate already awaiting a decision,
        // a paused/terminal mission) means a human is needed now, so stop.
        const nextGate =
          nextView.kind === 'ApproveGate'
            ? (updated.gates.find((g) => g.gateIndex === nextView.gateIndex) ?? null)
            : null;
        if (!nextGate || nextGate.currentStageHandoffId) break;
      }
      toast.success(
        stepsDrafted > 1
          ? `CariForge worked through ${stepsDrafted} steps on its own — review below.`
          : 'CariForge drafted this step — review it below.',
      );
      await onWritten();
    } catch (err) {
      // apiFetch's own thrown Error.message is always the generic
      // "apiFetch <path> failed (<status>)" — the route's actual, more
      // useful message (e.g. "CariForge could not draft this step right
      // now...") only ever lands in .cause.
      const cause = (err as { cause?: { error?: string } }).cause;
      toast.error(cause?.error ?? 'Could not draft this step. Try again shortly.');
    } finally {
      setDrafting(false);
      setDraftingStep(null);
    }
  };

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
            disabled={plan.button.draftWithAi && drafting}
            onClick={() => {
              if (plan.button?.opensDialog) setDialogOpen(true);
              else if (plan.button?.draftWithAi) void draftWithAi();
              else if (plan.button?.section) onOpenSection(plan.button.section);
            }}
          >
            {plan.button.draftWithAi && drafting
              ? `Working${draftingStep && draftingStep > 1 ? ` (step ${draftingStep})` : ''}…`
              : plan.button.label}
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
