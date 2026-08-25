// @polsia:user-owned — Single gate panel rendering.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { apiFetch } from '@/lib/api-client';
import {
  APPROVAL_DECISION_VALUES,
  GATE_DEFS,
  type GATE_REASON_CODES,
  GateDecide,
  type GateStateT,
  MissionDetail,
  type MissionDetailT,
} from '@/lib/contracts/forge';
import { applyServerErrors } from '@/lib/forms';

export function MissionGatePanel({
  missionId,
  gateState,
  onWritten,
}: {
  missionId: string;
  gateState: GateStateT;
  onWritten: () => Promise<void> | void;
}) {
  const gate = GATE_DEFS[gateState.gateIndex] ?? GATE_DEFS[0];
  if (!gate) throw new Error('Forge: GATE_DEFS empty');
  const form = useForm({
    resolver: zodResolver(GateDecide),
    defaultValues: {
      decision: 'Approve' as (typeof APPROVAL_DECISION_VALUES)[number],
      reasonCode: 'Approved' as (typeof GATE_REASON_CODES)[number],
      reasonText: '',
      stageHandoffId: gateState.currentStageHandoffId ?? '',
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/forge/missions/${missionId}/gates/${gateState.gateIndex}/decide`, {
        method: 'POST',
        body: JSON.stringify(values),
        schema: MissionDetail,
      });
      toast.success(`Gate ${gateState.gateIndex} decided`);
      onWritten();
    } catch (err) {
      const message = (err as Error).message ?? 'Could not decide gate';
      const cause = (err as { cause?: { errors?: Record<string, string> } }).cause;
      if (cause?.errors) {
        if (!applyServerErrors(cause, form.setError)) toast.error(message);
        return;
      }
      toast.error(message);
    }
  });

  return (
    <section className="glass-card space-y-3 rounded-2xl p-6">
      <header>
        <p className="text-caption uppercase tracking-wide text-brand-700">
          Gate {gateState.gateIndex} — {gate.stage}
        </p>
        <h3 className="text-h4">{gate.name}</h3>
        <p className="text-small text-muted-foreground">{gate.purpose}</p>
      </header>
      <dl className="grid grid-cols-2 gap-3 text-body md:grid-cols-4">
        <div>
          <dt className="text-caption text-muted-foreground">State</dt>
          <dd>{gateState.state}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Latest handoff</dt>
          <dd>{gateState.currentHandoffVersion ? `v${gateState.currentHandoffVersion}` : '—'}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-caption text-muted-foreground">Allowed reason codes</dt>
          <dd className="text-small">{gate.allowedReasonCodes.join(', ')}</dd>
        </div>
      </dl>
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-3">
          <FormField
            control={form.control}
            name="decision"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Decision</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {APPROVAL_DECISION_VALUES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
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
                    {gate.allowedReasonCodes.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reasonText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason text</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Why this decision?" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="stageHandoffId"
            render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Stage handoff being decided</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="glass-cta md:col-span-3"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Submitting…' : 'Record decision'}
          </Button>
        </form>
      </Form>
    </section>
  );
}

export function MissionGatePanelList({ detail: _detail }: { detail: MissionDetailT }) {
  return null;
}
