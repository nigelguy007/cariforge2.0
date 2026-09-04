// @polsia:user-owned — the compact approval dialog (brief, Step 4 + 7).
//
// Same governance contract as MissionGatePanel: POSTs the existing
// GateDecide body {decision, controls?, reasonCode, reasonText, stageHandoffId}
// to /api/forge/missions/{id}/gates/{gateIndex}/decide. What changed is only
// the presentation: plain-language options, a pre-drafted but editable
// Decision note, conditions shown only when "Approve with conditions" is
// chosen, and the reason code chosen from the gate's allowed list via a
// native select. Nothing is sent until the person presses the one primary
// button — the dialog never approves on its own.

'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  type ApprovalDecision,
  type GateStateT,
  MissionDetail,
  type ReasonCode,
  type StageName,
} from '@/lib/contracts/forge';
import {
  DECISION_OPTIONS,
  DECISION_UI,
  defaultReasonFor,
  draftDecisionNote,
  reasonLabel,
  STAGE_UI,
} from '@/lib/ui-terms';

export interface DecisionDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly missionId: string;
  readonly stage: StageName;
  readonly gate: GateStateT;
  /** Called after the decision is recorded so the workspace can refresh. */
  readonly onDecided: () => Promise<void> | void;
}

const SUBMIT_LABEL: Record<ApprovalDecision, string> = {
  Approve: 'Record approval',
  ApproveWithControls: 'Approve with conditions',
  Return: 'Ask for changes',
  Refuse: 'Stop this project',
};

type FieldErrors = Partial<Record<'note' | 'controls' | 'form', string>>;

export function DecisionDialog({
  open,
  onOpenChange,
  missionId,
  stage,
  gate,
  onDecided,
}: DecisionDialogProps) {
  const step = STAGE_UI[stage];
  const allowed = gate.allowedReasonCodes as readonly ReasonCode[];

  const [decision, setDecision] = React.useState<ApprovalDecision>('Approve');
  const [reasonCode, setReasonCode] = React.useState<ReasonCode>(() =>
    defaultReasonFor('Approve', gate.gateIndex),
  );
  const [note, setNote] = React.useState(() => draftDecisionNote('Approve', stage));
  const [noteTouched, setNoteTouched] = React.useState(false);
  const [controls, setControls] = React.useState('');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [busy, setBusy] = React.useState(false);

  // Reset to the expected action every time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setDecision('Approve');
    setReasonCode(defaultReasonFor('Approve', gate.gateIndex));
    setNote(draftDecisionNote('Approve', stage));
    setNoteTouched(false);
    setControls('');
    setErrors({});
    setBusy(false);
  }, [open, gate.gateIndex, stage]);

  function chooseDecision(next: ApprovalDecision) {
    setDecision(next);
    const suggested = defaultReasonFor(next, gate.gateIndex);
    setReasonCode(allowed.includes(suggested) ? suggested : (allowed[0] ?? suggested));
    if (!noteTouched) setNote(draftDecisionNote(next, stage));
    setErrors({});
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedNote = note.trim();
    const trimmedControls = controls.trim();
    const nextErrors: FieldErrors = {};
    if (!trimmedNote) nextErrors.note = 'Add a short decision note so the record explains why.';
    if (decision === 'ApproveWithControls' && !trimmedControls) {
      nextErrors.controls = 'List the conditions that must hold for this approval.';
    }
    if (!gate.currentStageHandoffId) {
      nextErrors.form = 'There is no step output to decide on yet.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/forge/missions/${missionId}/gates/${gate.gateIndex}/decide`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          controls: decision === 'ApproveWithControls' ? trimmedControls : undefined,
          reasonCode,
          reasonText: trimmedNote,
          stageHandoffId: gate.currentStageHandoffId,
        }),
        schema: MissionDetail,
      });
      toast.success('Decision recorded');
      onOpenChange(false);
      await onDecided();
    } catch (err) {
      const cause = (err as { cause?: { errors?: Record<string, string> } }).cause;
      const serverErrors = cause?.errors ?? {};
      const hasFieldErrors = Object.keys(serverErrors).length > 0;
      setErrors({
        note: serverErrors.reasonText,
        controls: serverErrors.controls,
        form:
          serverErrors.decision ??
          serverErrors.reasonCode ??
          serverErrors.stageHandoffId ??
          (hasFieldErrors
            ? undefined
            : ((err as Error).message ?? 'The decision could not be recorded. Try again.')),
      });
    } finally {
      setBusy(false);
    }
  }

  const controlsId = 'decision-controls';
  const noteId = 'decision-note';
  const reasonId = 'decision-reason';

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="app-shell max-w-lg gap-0 rounded-[var(--app-radius)] border-[var(--app-border)] bg-[var(--app-surface)] p-0">
        <form onSubmit={submit} noValidate>
          <DialogHeader className="space-y-1 px-5 pt-5 text-left">
            <DialogTitle className="app-h2">
              Step {step.number}: {step.title}
            </DialogTitle>
            <DialogDescription className="app-small text-[var(--app-text-muted)]">
              Your name and note go on the decision record. Nothing is approved until you confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <fieldset className="space-y-1.5">
              <legend className="app-small font-medium text-[var(--app-text)]">Decision</legend>
              <RadioGroup
                value={decision}
                onValueChange={(v) => chooseDecision(v as ApprovalDecision)}
                className="gap-1"
              >
                {DECISION_OPTIONS.map((option) => {
                  const id = `decision-${option.value}`;
                  return (
                    <div
                      key={option.value}
                      className="flex min-h-11 items-start gap-3 rounded-[var(--app-radius-sm)] px-2 py-1.5 hover:bg-[var(--secondary)]"
                    >
                      <RadioGroupItem value={option.value} id={id} className="mt-1" />
                      <Label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5">
                        <span className="app-body font-medium">{option.label}</span>
                        <span className="app-small font-normal text-[var(--app-text-muted)]">
                          {option.hint}
                        </span>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </fieldset>

            {decision === 'ApproveWithControls' ? (
              <div className="space-y-1.5">
                <Label htmlFor={controlsId} className="app-small font-medium">
                  Conditions
                </Label>
                <Textarea
                  id={controlsId}
                  value={controls}
                  onChange={(e) => setControls(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  aria-invalid={errors.controls ? true : undefined}
                  aria-describedby={errors.controls ? `${controlsId}-error` : undefined}
                  placeholder="What must hold for this approval to stand?"
                />
                {errors.controls ? (
                  <p id={`${controlsId}-error`} role="alert" className="app-small text-rose-700">
                    {errors.controls}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor={noteId} className="app-small font-medium">
                Decision note
              </Label>
              <Textarea
                id={noteId}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteTouched(true);
                }}
                rows={3}
                aria-invalid={errors.note ? true : undefined}
                aria-describedby={errors.note ? `${noteId}-error` : `${noteId}-hint`}
              />
              {errors.note ? (
                <p id={`${noteId}-error`} role="alert" className="app-small text-rose-700">
                  {errors.note}
                </p>
              ) : (
                <p id={`${noteId}-hint`} className="app-caption text-[var(--app-text-muted)]">
                  Pre-drafted for you — edit it so it says what you actually decided.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={reasonId} className="app-small font-medium">
                Reason on the record
              </Label>
              <select
                id={reasonId}
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as ReasonCode)}
                className="app-body h-11 w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 text-[var(--app-text)]"
              >
                {allowed.map((code) => (
                  <option key={code} value={code}>
                    {reasonLabel(code)}
                  </option>
                ))}
              </select>
            </div>

            {errors.form ? (
              <p role="alert" className="app-small text-rose-700">
                {errors.form}
              </p>
            ) : null}
          </div>

          <DialogFooter className="flex-row justify-end gap-2 border-t border-[var(--app-border)] px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={decision === 'Refuse' ? 'destructive' : 'default'}
              className="min-h-11"
              disabled={busy}
            >
              {busy ? 'Recording…' : SUBMIT_LABEL[decision]}
            </Button>
          </DialogFooter>
          <p className="sr-only">
            Selected: {DECISION_UI[decision]}. Reason: {reasonLabel(reasonCode)}.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
