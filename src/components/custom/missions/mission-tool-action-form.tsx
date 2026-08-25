// @polsia:user-owned — Propose tool action.
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
  type MissionDetailT,
  TOOL_SCOPE_VALUES,
  ToolActionCreate,
} from '@/lib/contracts/forge';
import { applyServerErrors } from '@/lib/forms';

export function MissionToolActionForm({
  detail,
  onWritten,
}: {
  detail: MissionDetailT;
  onWritten: () => Promise<void> | void;
}) {
  const form = useForm({
    resolver: zodResolver(ToolActionCreate),
    defaultValues: {
      tool: 'noop-runner',
      scope: 'Internal' as (typeof TOOL_SCOPE_VALUES)[number],
      payload: {} as Record<string, unknown>,
      requiresGateApproval: false,
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/forge/missions/${detail.mission.id}/tool-actions`, {
        method: 'POST',
        body: JSON.stringify(values),
        schema: MissionDetail,
      });
      toast.success('Tool action proposed');
      onWritten();
    } catch (err) {
      const message = (err as Error).message ?? 'Could not propose tool action';
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
        className="glass-card space-y-3 rounded-2xl p-6 md:grid md:grid-cols-2"
      >
        <FormField
          control={form.control}
          name="tool"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tool</FormLabel>
              <FormControl>
                <Input {...field} placeholder="noop-runner" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="scope"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Scope</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TOOL_SCOPE_VALUES.map((s) => (
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
          control={form.control}
          name="payload"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Payload (JSON)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={JSON.stringify(field.value ?? {})}
                  onChange={(e) => {
                    try {
                      field.onChange(JSON.parse(e.target.value));
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
        <label className="flex items-center gap-2 text-small md:col-span-2">
          <input
            type="checkbox"
            checked={form.watch('requiresGateApproval')}
            onChange={(e) => form.setValue('requiresGateApproval', e.target.checked)}
          />
          Requires prior gate approval (mandatory for External scope)
        </label>
        <Button
          type="submit"
          className="glass-cta md:col-span-2"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Proposing…' : 'Propose tool action'}
        </Button>
      </form>
    </Form>
  );
}
