// @polsia:user-owned — Single objection card.
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
  MissionDetail,
  OBJECTION_RESOLUTION_VALUES,
  type ObjectionItemT,
  ObjectionResolutionInput,
} from '@/lib/contracts/forge';
import { applyServerErrors } from '@/lib/forms';

export function MissionObjectionCard({
  missionId,
  objection,
  onWritten,
}: {
  missionId: string;
  objection: ObjectionItemT;
  onWritten: () => Promise<void> | void;
}) {
  const form = useForm({
    resolver: zodResolver(ObjectionResolutionInput),
    defaultValues: {
      resolution: 'Closed' as (typeof OBJECTION_RESOLUTION_VALUES)[number],
      resolutionText: '',
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/forge/missions/${missionId}/objections/${objection.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify(values),
        schema: MissionDetail,
      });
      toast.success('Objection resolved');
      onWritten();
    } catch (err) {
      const message = (err as Error).message ?? 'Could not resolve objection';
      const cause = (err as { cause?: { errors?: Record<string, string> } }).cause;
      if (cause?.errors) {
        if (!applyServerErrors(cause, form.setError)) toast.error(message);
        return;
      }
      toast.error(message);
    }
  });

  return (
    <article className="glass-card space-y-3 rounded-2xl p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-caption uppercase tracking-wide text-brand-700">
            {objection.raisedByRole}
          </p>
          <p className="text-h4">Objection</p>
        </div>
        <p className="text-small text-muted-foreground">
          {new Date(objection.raisedAt).toLocaleString()}
        </p>
      </header>
      <p className="text-body">{objection.text}</p>
      <p className="text-small text-muted-foreground">
        Handoff: <code>{objection.stageHandoffId.slice(-6)}</code>
      </p>
      <p className="text-small">
        Status: {objection.resolution ? `resolved (${objection.resolution})` : 'open'}
      </p>
      {objection.resolutionText ? (
        <p className="text-small">Resolution note: {objection.resolutionText}</p>
      ) : null}
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-3">
          <FormField
            control={form.control}
            name="resolution"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resolution</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {OBJECTION_RESOLUTION_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
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
            name="resolutionText"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Resolution note</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Why/how is this objection being resolved?" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="glass-outline-cta md:col-span-3"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Saving…' : 'Resolve objection'}
          </Button>
        </form>
      </Form>
    </article>
  );
}
