// @polsia:user-owned — the one visible next action (brief, Step 4).
//
// Maps the existing next-action view to a single sentence and at most one
// solid button. A formal approval opens DecisionDialog; every other kind
// (a concern to resolve, a requested action to decide, pause/resume/run
// again, a task to assign) opens the matching section of Supporting detail
// where the existing governance component does the work. Terminal states
// say what was produced — an approved, production-quality MVP — without
// claiming CariForge itself deployed it live.

'use client';

import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { useIsAdmin, useSession } from '@/lib/auth-client';
import { nextActionFor } from '@/lib/business/forge/next-action';
import {
  BuildJobProgress,
  MissionDetail,
  type MissionDetailT,
  type StageName,
} from '@/lib/contracts/forge';
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
  // Real user report (2026-09-05): "if the agent activity is ongoing why
  // is draft with ai button still avaioable" — the Draft with AI loop's
  // own in-flight `drafting`/stage state lived only in this component, so
  // the Agent activity list below had zero live signal that anything was
  // running: everything above it looked static/stuck even while a real
  // multi-stage chain was mid-flight. Optional so callers that don't need
  // it (there are none yet, but this stays a plain prop, not required)
  // don't have to pass a no-op.
  readonly onDraftingStageChange?: (stage: StageName | null) => void;
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
    // User's own flow (2026-09-05): "If they don't approve then ask for
    // more info - simple step I add more and then resubmit." CariForge
    // redrafts the step itself, addressing the reviewer's own feedback
    // (shown below) — reusing the same "Draft with AI" mechanism and its
    // auto-chaining, just aimed at a returned step instead of a fresh
    // one, so there is nothing new for the user to learn.
    case 'ReviseStage': {
      const step = STAGE_UI[action.stage];
      return {
        heading: `${step.title} — more information needed`,
        sentence: canDraft
          ? humaniseCopy(action.rationale)
          : 'Reviewers asked for more information on this step before it can move forward. This is arranged by the project owner.',
        button: canDraft ? { label: 'Redraft with AI', draftWithAi: true } : undefined,
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
        // Wording changed 2026-09-06 (direct user instruction) — was "...
        // evidence receipt — not a production deployment.", which read as
        // a dead end. Now frames the receipt as the input to the next,
        // separate step rather than a boundary statement.
        sentence: `The ${PROTOTYPE_PACKAGE} has been approved. It is a finished, ready-to-use solution with its Project plan, Operating guide and evidence receipt to convert into a production deployment.`,
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
  onDraftingStageChange,
}: NextActionCardProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);
  const [draftingStep, setDraftingStep] = React.useState<number | null>(null);
  // File-by-file progress while the SoftwareBuild stage's async job runs
  // (2026-09-06 — see runBuildJob below). null outside that stage, or
  // before its planning step reports a file count yet.
  const [buildProgress, setBuildProgress] = React.useState<{
    current: number;
    total: number;
  } | null>(null);
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
  // Real production incident (2026-09-06): the SoftwareBuild stage's own
  // AI call is deliberately sized for ~150s — a real MVP's file/spec
  // generation genuinely takes that long — but this project's Vercel plan
  // (Hobby) kills any function at 60s, which showed up live as "says
  // Working… then crashes". Fixed with a resumable job (build-job/
  // route.ts) instead of upgrading to Vercel Pro: this polls that job
  // forward one bounded step at a time (plan, one file, or finalize),
  // each well under 60s, until it reports Done or Failed. A hard cap
  // (matching MAX_AUTO_STAGES below) against ever polling forever if a
  // real bug ever left a job stuck oscillating between two states.
  const MAX_BUILD_JOB_POLLS = 40;
  const runBuildJob = async (
    missionId: string,
    onProgress: (p: { current: number; total: number } | null) => void,
  ): Promise<MissionDetailT> => {
    for (let i = 0; i < MAX_BUILD_JOB_POLLS; i++) {
      const result = await apiFetch(`/api/forge/missions/${missionId}/build-job`, {
        method: 'POST',
        schema: BuildJobProgress,
      });
      if (result.status === 'Done') return result.detail;
      if (result.status === 'Failed')
        throw new Error(result.error, { cause: { error: result.error } });
      onProgress(result.status === 'Generating' ? result.progress : null);
    }
    throw new Error('apiFetch build-job exceeded its poll cap', {
      cause: { error: 'This build is taking longer than expected. Try again shortly.' },
    });
  };

  const MAX_AUTO_STAGES = 5; // one loop iteration per real stage, hard cap against ever looping forever
  const draftWithAi = async () => {
    setDrafting(true);
    // Real user report (2026-09-05): "system seems to be [s]tuck at
    // workflow agent. nothing happening at all" — the loop below was
    // already chaining through stages correctly, but nothing outside this
    // button's own text ever reflected that, so the whole rest of the
    // page (the Agent activity list in particular) looked frozen the
    // entire time a multi-stage chain was running. Track which real stage
    // is being worked on right now and report it up so Agent activity can
    // show that stage as "Working…" live, in sync with this button.
    let currentStage: StageName | null =
      action.kind === 'ApproveGate' || action.kind === 'ReviseStage' ? action.stage : null;
    try {
      let stepsDrafted = 0;
      for (let i = 0; i < MAX_AUTO_STAGES; i++) {
        setDraftingStep(i + 1);
        onDraftingStageChange?.(currentStage);
        const updated =
          currentStage === 'SoftwareBuild'
            ? await runBuildJob(detail.mission.id, setBuildProgress)
            : await apiFetch(`/api/forge/missions/${detail.mission.id}/draft`, {
                method: 'POST',
                schema: MissionDetail,
              });
        setBuildProgress(null);
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
        if (nextView.kind !== 'ApproveGate') break; // unreachable — nextGate is only ever set for this kind, but keeps TS's narrowing honest
        currentStage = nextView.stage;
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
      setBuildProgress(null);
      onDraftingStageChange?.(null);
    }
  };

  return (
    <section
      aria-labelledby="next-action-heading"
      className={plan.button ? 'app-panel-action p-5 sm:p-6' : 'app-panel p-5 sm:p-6'}
    >
      <p className="app-caption text-[var(--app-text-muted)]">
        {isTerminal ? 'Outcome' : 'Your next action'}
      </p>
      <h2 id="next-action-heading" className="app-h2 mt-1 text-[var(--app-text)]">
        {plan.heading}
      </h2>
      <p className="app-body mt-1.5 max-w-prose text-[var(--app-text-muted)]">{plan.sentence}</p>

      {/* Real inconsistency found live (2026-09-05) verifying the terminal
          rejection fix above: a closed/rejected mission still has a
          Refused gate in "non-Awaiting state", which is exactly what
          this list warns about — so a project that just got the "sorry,
          this didn't get approved" message also showed "Before you can
          continue: 1 approval(s) in non-Awaiting state" right underneath
          it, implying there was still something to do. There is not —
          nothing "continues" on a closed mission. */}
      {!isTerminal && blockers.length > 0 ? (
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
              ? buildProgress
                ? // The SoftwareBuild stage's own real per-file progress
                  // (2026-09-06) — this stage takes noticeably longer than
                  // the others, so a bare "Working…" for a couple of
                  // minutes reads as stuck; showing which file is
                  // genuinely in flight fixes that without inventing a
                  // fake percentage.
                  `Working (file ${buildProgress.current + 1} of ${buildProgress.total})…`
                : `Working${draftingStep && draftingStep > 1 ? ` (step ${draftingStep})` : ''}…`
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
