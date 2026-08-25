// @polsia:user-owned — Correct a handoff (supersede with new version).
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
import type { MissionDetailT } from '@/lib/contracts/forge';
import { GATE_REASON_CODES, HandoffCorrect, MissionDetail } from '@/lib/contracts/forge';
import { applyServerErrors } from '@/lib/forms';

export function MissionHandoffCorrectForm({
  detail,
  onWritten,
}: {
  detail: MissionDetailT;
  onWritten: () => Promise<void> | void;
}) {
  const latestHandoff = detail.handoffs[0];
  const form = useForm({
    resolver: zodResolver(HandoffCorrect),
    defaultValues: {
      payload: (latestHandoff?.payload ?? {}) as Record<string, unknown>,
      confidence: latestHandoff?.confidence ?? 0.7,
      missingEvidence: [] as unknown[],
      reasonCode: 'UserCorrection' as (typeof GATE_REASON_CODES)[number],
      reasonText: '',
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    if (!latestHandoff) {
      toast.error('No handoff to correct yet');
      return;
    }
    try {
      await apiFetch(
        `/api/forge/missions/${detail.mission.id}/handoffs/${latestHandoff.id}/correct`,
        {
          method: 'POST',
          body: JSON.stringify({
            confidence: Number(values.confidence),
            payload: values.payload,
            missingEvidence: values.missingEvidence,
            reasonCode: values.reasonCode,
            reasonText: values.reasonText,
          }),
          schema: MissionDetail,
        },
      );
      toast.success('Handoff corrected');
      onWritten();
    } catch (err) {
      const message = (err as Error).message ?? 'Could not correct handoff';
      const cause = (err as { cause?: { errors?: Record<string, string> } }).cause;
      if (cause?.errors) {
        if (!applyServerErrors(cause, form.setError)) toast.error(message);
        return;
      }
      toast.error(message);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="glass-card space-y-4 rounded-2xl p-6">
        <h2 className="text-h3">Correct latest handoff</h2>
        <p className="text-small text-muted-foreground">
          Submits a new version that supersedes the most recent handoff and invalidates downstream
          stages.
        </p>
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
                  {GATE_REASON_CODES.map((code) => (
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
              <FormLabel>Reason text (attribution)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Why this handoff is being corrected" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="glass-outline-cta" disabled={form.formState.isSubmitting}>
          Submit correction
        </Button>
      </form>
    </Form>
  );
}
