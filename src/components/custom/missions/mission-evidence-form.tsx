// @polsia:user-owned — Attach evidence client form.
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
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  EVIDENCE_KIND_VALUES,
  EvidenceCreate,
  MissionDetail,
  type MissionDetailT,
} from '@/lib/contracts/forge';
import { applyServerErrors } from '@/lib/forms';
import { humanise } from '@/lib/ui-terms';

export function MissionEvidenceForm({
  detail,
  onWritten,
}: {
  detail: MissionDetailT;
  onWritten: () => Promise<void> | void;
}) {
  const form = useForm({
    resolver: zodResolver(EvidenceCreate),
    defaultValues: {
      kind: 'Text' as (typeof EVIDENCE_KIND_VALUES)[number],
      ref: '',
      label: '',
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/forge/missions/${detail.mission.id}/evidence`, {
        method: 'POST',
        body: JSON.stringify(values),
        schema: MissionDetail,
      });
      toast.success('Evidence attached');
      onWritten();
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not attach evidence');
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
      <form
        onSubmit={onSubmit}
        className="glass-card space-y-3 rounded-2xl p-6 md:grid md:grid-cols-4"
      >
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kind</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {EVIDENCE_KIND_VALUES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {humanise(k)}
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
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. WS-Bench baseline" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ref"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Reference (URL or note path)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="note://baseline-2026-01-01 or https://…" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="glass-cta md:col-span-4"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Saving…' : 'Attach evidence'}
        </Button>
      </form>
    </Form>
  );
}
