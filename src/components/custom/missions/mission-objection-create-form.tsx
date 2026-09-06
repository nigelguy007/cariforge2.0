// @polsia:user-owned — Raise an objection client form.
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
import { MissionDetail, type MissionDetailT, ObjectionCreate } from '@/lib/contracts/forge';
import { applyServerErrors } from '@/lib/forms';
import { stepLabel } from '@/lib/ui-terms';

export function MissionObjectionCreateForm({
  detail,
  onWritten,
}: {
  detail: MissionDetailT;
  onWritten: () => Promise<void> | void;
}) {
  const latestHandoff = detail.handoffs[0];
  const form = useForm({
    resolver: zodResolver(ObjectionCreate),
    defaultValues: {
      stageHandoffId: latestHandoff?.id ?? '',
      raisedByRole: 'Operator',
      text: '',
      evidenceRefId: '',
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/forge/missions/${detail.mission.id}/objections`, {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          evidenceRefId: values.evidenceRefId || undefined,
        }),
        schema: MissionDetail,
      });
      toast.success('Objection raised');
      onWritten();
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not raise objection');
      const cause = (err as { cause?: { errors?: Record<string, string> } }).cause;
      if (cause?.errors) {
        if (!applyServerErrors(cause, form.setError)) toast.error(message);
        return;
      }
      toast.error(message);
    }
  });

  const handoffOptions = detail.handoffs;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="glass-card space-y-4 rounded-2xl p-6">
        <h2 className="text-h3">Raise an objection</h2>
        <FormField
          control={form.control}
          name="stageHandoffId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Which step is this about?</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a step" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {handoffOptions.length === 0 ? (
                    <SelectItem value="" disabled>
                      No step output yet
                    </SelectItem>
                  ) : (
                    handoffOptions.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {stepLabel(h.stage)} (version {h.version})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="raisedByRole"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role raising it</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Operator / Compliance / Procurement …" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Objection text</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  placeholder="What is the concern, and what evidence supports it?"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="evidenceRefId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Linked evidence ID (optional)</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} placeholder="ev_x_y" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="glass-cta" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Submitting…' : 'Raise objection'}
        </Button>
      </form>
    </Form>
  );
}
