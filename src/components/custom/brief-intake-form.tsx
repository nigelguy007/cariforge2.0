// @polsia:user-owned — brief intake form (client island for the home page).
// POSTs to /api/leads, renders an inline success card on 201, and surfaces
// server-side field validation via applyServerErrors. No server-only imports.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { LeadCreate, LeadItem } from '@/lib/contracts/leads';
import { applyServerErrors } from '@/lib/forms';

// react-hook-form's resolver wants the INPUT shape (before the schema's
// transform). `z.input` is the pre-parse shape: brief required, email optional.
type FormValues = z.input<typeof LeadCreate>;

export function BriefIntakeForm() {
  const [submitted, setSubmitted] = useState<LeadItem | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(LeadCreate),
    defaultValues: { brief: '', email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await apiFetch('/api/leads', {
        method: 'POST',
        body: JSON.stringify(values),
        schema: LeadItem,
      });
      setSubmitted(created);
    } catch (err) {
      const applied = err instanceof Error && applyServerErrors(err.cause, form.setError);
      if (!applied) toast.error('Could not save your brief. Please try again.');
    }
  });

  if (submitted) {
    return (
      <div className="glass-card flex flex-col gap-3 rounded-2xl p-6 text-card-foreground">
        <p className="font-display text-h4 tracking-tight">Brief received.</p>
        <p className="text-small text-card-foreground/80">
          {submitted.notified
            ? "Logged and forwarded to the team — we'll reply from a named human within 48 hours."
            : "Logged. We're still in pilot — expect a slower reply while we set up the inbox."}
        </p>
        <p className="text-caption text-muted-foreground">
          Reference: <span className="font-mono text-card-foreground">{submitted.id}</span>
          {' · '}captured {submitted.createdAt.slice(0, 10)}.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          control={form.control}
          name="brief"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your one-line brief</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. We need to triage claims documents against EU AI Act Article 14 before 2 August 2026…"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                20–500 characters. The council reads this verbatim before ruling.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Reply-to <span className="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@regulated-eu.example" {...field} />
              </FormControl>
              <FormDescription>Only used to send you the team&rsquo;s reply.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting}
          className="shadow-brand"
        >
          {form.formState.isSubmitting ? 'Sending…' : 'Submit your brief'}
        </Button>
      </form>
    </Form>
  );
}
