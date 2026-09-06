// @polsia:user-owned — Submit next handoff client island.
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
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { HandoffCreate, MissionDetail, STAGE_NAMES } from '@/lib/contracts/forge';
import { applyServerErrors } from '@/lib/forms';

export function MissionHandoffForm({
  missionId,
  onWritten,
}: {
  missionId: string;
  onWritten: () => Promise<void> | void;
}) {
  const form = useForm({
    resolver: zodResolver(HandoffCreate),
    defaultValues: {
      stage: 'Discovery' as (typeof STAGE_NAMES)[number],
      payload: { needs: [], risks: [], questions: [] } as Record<string, unknown>,
      confidence: 0.7,
      missingEvidence: [] as unknown[],
      toolRefs: [] as string[],
      parentVersionId: undefined,
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/forge/missions/${missionId}/handoffs`, {
        method: 'POST',
        body: JSON.stringify({
          stage: values.stage,
          confidence: Number(values.confidence),
          payload: values.payload,
          missingEvidence: values.missingEvidence,
          toolRefs: values.toolRefs,
          parentVersionId: values.parentVersionId,
        }),
        schema: MissionDetail,
      });
      toast.success('Handoff submitted');
      onWritten();
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not submit handoff');
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
        <h2 className="text-h3">Submit a handoff</h2>
        <FormField
          control={form.control}
          name="stage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stage</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {STAGE_NAMES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
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
          name="confidence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confidence (0–1)</FormLabel>
              <FormControl>
                <Input {...field} type="number" step="0.05" min="0" max="1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="payload"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payload (JSON)</FormLabel>
              <FormControl>
                <Textarea
                  rows={6}
                  name={field.name}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  value={JSON.stringify(field.value ?? {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value) as Record<string, unknown>;
                      field.onChange(parsed);
                    } catch {
                      field.onChange({ raw: e.target.value });
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="glass-cta" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Submitting…' : 'Submit handoff'}
        </Button>
      </form>
    </Form>
  );
}
