// @polsia:user-owned — the workflow configurator (Priority-11 item from the
// Aug 2026 enterprise-platform handoff doc). A prospect describes what they
// want to build in free text; POSTs to /api/configurator; renders the
// indicative fit read-out inline. Modeled on brief-intake-form.tsx's shape
// (zodResolver + react-hook-form + apiFetch), but this form's result is
// never persisted and never gates anything — see contracts/configurator.ts.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, HelpCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { GlassChip } from '@/components/custom/glass';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  ConfiguratorRequest,
  ConfiguratorResponse,
  type ConfiguratorResponseT,
  type ConfiguratorResultT,
} from '@/lib/contracts/configurator';

type FormValues = z.infer<typeof ConfiguratorRequest>;

const FIT_LABEL: Record<ConfiguratorResultT['fit'], string> = {
  strong: 'Looks like a strong fit',
  possible: 'Could be a fit, with caveats',
  unlikely: 'Probably not a fit for a 21-day proof',
};
const FIT_TONE: Record<ConfiguratorResultT['fit'], 'strong' | 'outline' | 'muted'> = {
  strong: 'strong',
  possible: 'outline',
  unlikely: 'muted',
};

function ResultCard({ result }: { result: ConfiguratorResultT }) {
  return (
    <div className="glass-card flex flex-col gap-4 rounded-2xl p-6 text-card-foreground">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-brand-600" aria-hidden="true" />
        <GlassChip tone={FIT_TONE[result.fit]} size="lg">
          {FIT_LABEL[result.fit]}
        </GlassChip>
      </div>
      <p className="text-small text-card-foreground/85">{result.summary}</p>

      {result.agentFocus.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Which agents would carry this
          </p>
          <ul className="flex flex-col gap-1.5">
            {result.agentFocus.map((f) => (
              <li key={f.agent} className="text-small text-card-foreground/85">
                <span className="font-semibold text-foreground">{f.agent}.</span> {f.why}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.riskFlags.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Risk flags
          </p>
          <ul className="flex flex-col gap-1 text-small text-card-foreground/85">
            {result.riskFlags.map((r) => (
              <li key={r}>&middot; {r}</li>
            ))}
          </ul>
        </div>
      )}

      {result.clarifyingQuestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <HelpCircle className="size-3" aria-hidden="true" />
            What Discovery would ask first
          </p>
          <ul className="flex flex-col gap-1 text-small text-card-foreground/85">
            {result.clarifyingQuestions.map((q) => (
              <li key={q}>&middot; {q}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="border-t border-border pt-3 text-caption text-muted-foreground">
        This is an automated, indicative read — not a ruling. Only a named human at a real Discovery
        gate can actually decide whether a case moves forward.
      </p>
    </div>
  );
}

export function WorkflowConfigurator() {
  const [outcome, setOutcome] = useState<ConfiguratorResponseT | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(ConfiguratorRequest),
    defaultValues: { description: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setOutcome(null);
    try {
      const response = await apiFetch('/api/configurator', {
        method: 'POST',
        body: JSON.stringify(values),
        schema: ConfiguratorResponse,
      });
      setOutcome(response);
      if (response.status === 'unavailable') {
        toast.error(
          'The configurator is unavailable right now — try the front-door brief instead.',
        );
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not run the configurator. Please try again.'));
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sanity-check your idea</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. We want to triage incoming service requests and route the ones missing required documents back to the requester automatically…"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting}
          className="self-start"
        >
          {form.formState.isSubmitting ? 'Reading it…' : 'Get an indicative read'}
        </Button>
      </form>

      {outcome?.status === 'ok' && (
        <div className="mt-6">
          <ResultCard result={outcome.result} />
        </div>
      )}
      {outcome?.status === 'unavailable' && (
        <p className="mt-6 text-small text-muted-foreground">
          The configurator couldn&rsquo;t run just now. That&rsquo;s never a reason to stop —{' '}
          <a href="#front-door" className="link-brand">
            leave the full brief below
          </a>{' '}
          and a named human will read it directly.
        </p>
      )}
    </Form>
  );
}
