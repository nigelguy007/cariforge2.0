// @polsia:user-owned — Bounded work-items panel: list, transition, attach
// test evidence. Client island.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { progressSummary } from '@/lib/business/forge/work-items';
import {
  GATE_REASON_CODES,
  type ReasonCode,
  WORK_ITEM_STATUS_VALUES,
  WorkItemList,
  WorkItemRead,
  type WorkItemReadT,
  type WorkItemStatusT,
  WorkItemStatusTransition,
  WorkItemTestEvidenceAttach,
} from '@/lib/contracts/forge';
import { applyServerErrors } from '@/lib/forms';

export function MissionWorkItemsPanel({ missionId }: { missionId: string }) {
  const [items, setItems] = React.useState<WorkItemReadT[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const list = await apiFetch(`/api/forge/missions/${missionId}/work-items`, {
        schema: WorkItemList,
      });
      setItems(list.items);
    } catch (err) {
      setError(apiErrorMessage(err, 'These tasks could not be loaded.'));
    }
  }, [missionId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-foreground">Could not load work items: {error}</p>
      </div>
    );
  }
  if (items === null) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-muted-foreground">Loading work items…</p>
      </div>
    );
  }
  const summary = progressSummary(
    items.map((it) => ({
      id: it.id,
      status: it.status,
      closedAt: it.closedAt,
      supersededById: it.supersededById,
    })),
  );
  return (
    <section className="glass-card space-y-4 rounded-2xl p-6">
      <header>
        <p className="text-caption uppercase tracking-wide text-brand-700">Bounded work items</p>
        <h3 className="text-h3">Workflow items</h3>
        <p className="mt-1 text-small text-muted-foreground">
          Each item is bounded by a parent stage handoff, carries its own scope and acceptance
          criteria, and flows through the Operating cycle until tests pass.
        </p>
      </header>
      <p className="text-body">
        {summary.passed}/{summary.total} passed ({Math.round(summary.pctPassed * 100)}%).
        {summary.open + summary.inProgress + summary.inTest + summary.rework > 0
          ? ' In-flight items below.'
          : ' No items in flight.'}
      </p>
      {items.length === 0 ? (
        <p className="text-small text-muted-foreground">
          No yet work items. Use the Workflow stage handoff payload to seed items, then transition
          them from Open → InProgress → InTest → Passed.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-h4">{it.title}</p>
                  <p className="text-small text-muted-foreground">
                    Status: {it.status}
                    {it.ownerUserId ? ` · Owner: ${it.ownerUserId}` : ''}
                  </p>
                </div>
                <WorkItemControls item={it} onWritten={refresh} />
              </div>
              <p className="mt-2 text-small">
                <strong>Scope:</strong> {it.scope}
              </p>
              <p className="mt-1 text-small">
                <strong>AC:</strong> {it.acceptanceCriteria}
              </p>
              {it.testEvidenceRefIds.length > 0 ? (
                <p className="mt-1 text-small">
                  Test evidence: {it.testEvidenceRefIds.length} ref(s).
                </p>
              ) : (
                <p className="mt-1 text-small text-muted-foreground">
                  No test evidence attached yet.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WorkItemControls({
  item,
  onWritten,
}: {
  item: WorkItemReadT;
  onWritten: () => Promise<void> | void;
}) {
  const evidenceForm = useForm({
    resolver: zodResolver(WorkItemTestEvidenceAttach),
    defaultValues: { evidenceRefId: '' },
  });
  const onAttachTestEvidence = evidenceForm.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/forge/missions/${item.missionId}/work-items/${item.id}/test-evidence`, {
        method: 'POST',
        body: JSON.stringify(values),
        schema: WorkItemRead,
      });
      toast.success('Test evidence attached.');
      await onWritten();
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not attach test evidence');
      const cause = (err as { cause?: { errors?: Record<string, string> } }).cause;
      if (cause?.errors) {
        if (!applyServerErrors(cause, evidenceForm.setError)) toast.error(message);
        return;
      }
      toast.error(message);
    }
  });

  const transitionForm = useForm({
    resolver: zodResolver(WorkItemStatusTransition),
    defaultValues: {
      status: 'InProgress' as WorkItemStatusT,
      reasonCode: 'UserCorrection' as ReasonCode,
      reasonText: '',
    },
  });
  const onTransition = transitionForm.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/forge/missions/${item.missionId}/work-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
        schema: WorkItemRead,
      });
      toast.success(`Transition → ${values.status}`);
      await onWritten();
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not record the transition');
      const cause = (err as { cause?: { errors?: Record<string, string> } }).cause;
      if (cause?.errors) {
        if (!applyServerErrors(cause, transitionForm.setError)) toast.error(message);
        return;
      }
      toast.error(message);
    }
  });

  return (
    <div className="flex flex-col gap-2">
      <Form {...transitionForm}>
        <form
          onSubmit={onTransition}
          className="flex flex-wrap items-end gap-2"
          aria-label="Transition work item"
        >
          <FormField
            control={transitionForm.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {WORK_ITEM_STATUS_VALUES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={transitionForm.control}
            name="reasonCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason code</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {GATE_REASON_CODES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={transitionForm.control}
            name="reasonText"
            render={({ field }) => (
              <FormItem className="min-w-64">
                <FormLabel>Reason text</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={2} placeholder="Why this transition?" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="glass-outline-cta"
            disabled={transitionForm.formState.isSubmitting}
          >
            Transition
          </Button>
        </form>
      </Form>
      <Form {...evidenceForm}>
        <form
          onSubmit={onAttachTestEvidence}
          className="flex flex-wrap items-end gap-2"
          aria-label="Attach test evidence"
        >
          <FormField
            control={evidenceForm.control}
            name="evidenceRefId"
            render={({ field }) => (
              <FormItem className="min-w-64">
                <FormLabel>Evidence ID</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="ev_…" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="glass-cta"
            disabled={evidenceForm.formState.isSubmitting}
          >
            Attach test evidence
          </Button>
        </form>
      </Form>
    </div>
  );
}
