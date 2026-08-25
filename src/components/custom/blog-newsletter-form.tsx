// @polsia:user-owned — newsletter signup form (client island for /blog).
// POSTs to /api/newsletter, writes a Lead tagged 'newsletter', renders an
// inline thank-you card on 201 with a secondary CTA → /request-walkthrough
// for readers who become procurement-ready. Field-level validation surfaces
// inline via applyServerErrors; transient errors fall back to a toast. No
// server-only imports — mirrors the <BriefIntakeForm/> shape.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
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
import { apiFetch } from '@/lib/api-client';
import { NewsletterAck, NewsletterSignup } from '@/lib/contracts/newsletter';
import { applyServerErrors } from '@/lib/forms';

type FormValues = z.input<typeof NewsletterSignup>;

export function NewsletterSignupForm() {
  const [submitted, setSubmitted] = useState<NewsletterAck | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(NewsletterSignup),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const ack = await apiFetch('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify(values),
        schema: NewsletterAck,
      });
      setSubmitted(ack);
    } catch (err) {
      const applied = err instanceof Error && applyServerErrors(err.cause, form.setError);
      if (!applied) toast.error('Could not sign you up. Please try again.');
    }
  });

  if (submitted) {
    return (
      <div className="glass-card flex flex-col gap-3 rounded-2xl p-6 text-card-foreground">
        <div className="flex items-center gap-2">
          <MailCheck aria-hidden className="size-5 text-brand-700" />
          <p className="font-display text-h4 tracking-tight">You're on the list.</p>
        </div>
        <p className="text-small text-card-foreground/80">
          {submitted.notified
            ? "Logged and forwarded to the team — we'll send editor notes, EU AI Act updates, and the council's read of the latest regulatory backlog."
            : "Logged. We're still in pilot — expect a slower first mailer while we set up the inbox."}
        </p>
        <p className="text-caption text-muted-foreground">
          Reference: <span className="font-mono text-card-foreground">{submitted.id}</span>
          {' · '}captured {submitted.createdAt.slice(0, 10)}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-2 self-start">
          <Link href="/request-walkthrough">
            Ready to brief the council? Request a walkthrough →
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Work email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@regulated-eu.example"
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
          className="shadow-brand"
        >
          {form.formState.isSubmitting ? 'Signing up…' : 'Join the briefing list'}
        </Button>
      </form>
    </Form>
  );
}
