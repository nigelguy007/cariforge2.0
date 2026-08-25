// @polsia:user-owned — Dev / operator helper: POST a model+chat usage
// payload through the cost-attribution pipeline so a tester can confirm the
// UI surfaces an HONEST `unknown` badge when the model is missing from
// COST_TABLE. Read from existing patterns (MissionHandoffForm).

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
import { UsageRecordRead, UsageRecordWrite } from '@/lib/contracts/telemetry';
import { applyServerErrors } from '@/lib/forms';

export function UsageRecorder({ missionId }: { missionId: string }) {
  const form = useForm({
    resolver: zodResolver(UsageRecordWrite),
    defaultValues: {
      kind: 'model' as const,
      data: {
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        promptTokens: 1000,
        completionTokens: 200,
        attributedActor: 'AIOnly' as 'AIOnly' | 'Human' | 'Hybrid',
      },
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload =
        values.kind === 'model'
          ? {
              kind: 'model' as const,
              data: {
                model: values.data.model,
                provider: (values.data as { provider?: string }).provider ?? 'anthropic',
                promptTokens: (values.data as { promptTokens?: number }).promptTokens ?? 0,
                completionTokens:
                  (values.data as { completionTokens?: number }).completionTokens ?? 0,
                attributedActor:
                  (values.data as { attributedActor?: 'AIOnly' | 'Human' | 'Hybrid' })
                    .attributedActor ?? 'AIOnly',
              },
            }
          : {
              kind: 'chat' as const,
              data: {
                scope:
                  (values.data as { scope?: 'mission' | 'company' | 'platform' }).scope ??
                  'mission',
                model: values.data.model,
                messageCount: (values.data as { messageCount?: number }).messageCount ?? 0,
                windowStart:
                  (values.data as { windowStart?: string }).windowStart ??
                  '2026-05-01T00:00:00.000Z',
                windowEnd:
                  (values.data as { windowEnd?: string }).windowEnd ?? '2026-05-01T01:00:00.000Z',
              },
            };
      const result = await apiFetch(`/api/forge/missions/${missionId}/telemetry/usage`, {
        method: 'POST',
        body: JSON.stringify(payload),
        schema: UsageRecordRead,
      });
      toast.success(
        result.unknownCost
          ? `Recorded ${payload.kind} usage — HONEST unknown cost surfaced`
          : `Recorded ${payload.kind} usage — ${result.costCents} cents`,
      );
      form.reset(payload);
    } catch (err) {
      const e = err as Error & { cause?: unknown };
      if (e?.cause && typeof e.cause === 'object') {
        const applied = applyServerErrors(e.cause, form.setError);
        if (applied) return;
      }
      toast.error(e.message ?? 'Could not record usage');
    }
  });

  const kind = form.watch('kind');

  return (
    <section className="glass-card rounded-2xl p-6">
      <header>
        <p className="text-eyebrow text-brand-700">Usage recorder (operator helper)</p>
        <h2 className="text-h3">Record telemetry</h2>
        <p className="mt-1 text-small text-muted-foreground">
          Posts a model or chat usage row through the cost-attribution pipeline — unknown model =
          HONEST <code>unknownCost: true</code>.
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kind</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="model">Model usage</SelectItem>
                      <SelectItem value="chat">Chat usage</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="data.model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="claude-sonnet-4-6 or unknown-future for an HONEST marker"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {kind === 'model' ? (
            <>
              <FormField
                control={form.control}
                name="data.provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="anthropic" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data.promptTokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt tokens</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data.completionTokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Completion tokens</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data.attributedActor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attributed actor</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AIOnly">AI only</SelectItem>
                          <SelectItem value="Human">Human</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : (
            <>
              <FormField
                control={form.control}
                name="data.scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scope</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mission">Mission</SelectItem>
                          <SelectItem value="company">Company</SelectItem>
                          <SelectItem value="platform">Platform</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data.messageCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message count</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data.windowStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Window start (iso)</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data.windowEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Window end (iso)</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" className="glass-cta rounded-full">
              Record usage
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
