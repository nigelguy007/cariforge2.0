// @polsia:user-owned — requirements-intake form (client island for the home
// page). POSTs to /api/leads, renders an inline success card on 201, and
// surfaces server-side field validation via applyServerErrors. No
// server-only imports.
//
// Renamed from "one-line brief" to "what do you want to build using AI?"
// per explicit correction: this is the actual requirements-capture area,
// not a literal one-liner — the textarea grew accordingly (3 rows -> 6,
// 500-char cap -> 4000, see contracts/leads.ts) and the copy throughout
// stopped describing it as one line.
//
// Document attachment: NOT implemented yet, on purpose. This app has no
// file-storage integration (checked package.json — no Vercel Blob/S3/
// equivalent dependency), and per this project's marketplace-integration
// requirement, provisioning one needs the user to run /marketplace
// themselves — that command can't be invoked from inside a session. The
// attach control below is a real, honestly-disabled affordance (not a
// button that silently no-ops when clicked) so the intent is visible in
// the UI while storage is pending, not a mock pretending to work.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Paperclip } from 'lucide-react';
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
              <FormLabel>What do you want to build using AI?</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. We need to triage claims documents against EU AI Act Article 14 before 2 August 2026. Today a team of six does this by hand in a shared inbox — we need something that reads each claim, flags the ones missing required disclosures, and routes them to the right reviewer…"
                  rows={6}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Write as much as the problem needs — 20–4000 characters. The Oracles read this
                verbatim before ruling.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-small font-medium text-foreground">
            Attach a document <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          {/* Honestly disabled, not a silent no-op: file storage isn't
              provisioned yet (see the file header). Runs /marketplace to
              set up Vercel Blob or equivalent before this can go live. */}
          <button
            type="button"
            disabled
            title="Document attachment is being set up — for now, paste the key details above."
            className="flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-small text-muted-foreground opacity-70"
          >
            <Paperclip className="size-4" aria-hidden="true" />
            Coming soon — for now, paste the key details above
          </button>
        </div>
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
