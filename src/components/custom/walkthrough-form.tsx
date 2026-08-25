// @polsia:user-owned — walkthrough intake form (client island for
// /request-walkthrough). POSTs to /api/leads with source='walkthrough',
// renders an inline success card on 201, and surfaces server-side field
// validation via applyServerErrors. No server-only imports — matches the
// pattern set by <BriefIntakeForm/>.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  WalkthroughAck,
  WalkthroughCreate,
  WalkthroughRole,
  WalkthroughSegment,
} from '@/lib/contracts/walkthrough';
import { applyServerErrors } from '@/lib/forms';

type FormValues = z.input<typeof WalkthroughCreate>;

const ROLE_OPTIONS = WalkthroughRole.options;
const SEGMENT_OPTIONS = WalkthroughSegment.options;

export function WalkthroughForm() {
  const [submitted, setSubmitted] = useState<WalkthroughAck | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(WalkthroughCreate),
    defaultValues: {
      fullName: '',
      workEmail: '',
      organisation: '',
      role: 'Procurement',
      segment: 'Financial services',
      description: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await apiFetch('/api/leads', {
        method: 'POST',
        body: JSON.stringify({ source: 'walkthrough', ...values }),
        schema: WalkthroughAck,
      });
      setSubmitted(created);
    } catch (err) {
      const applied = err instanceof Error && applyServerErrors(err.cause, form.setError);
      if (!applied) toast.error('Could not save your walkthrough request. Please try again.');
    }
  });

  const resetForAnother = () => {
    setSubmitted(null);
    form.reset();
  };

  if (submitted) {
    return (
      <div className="glass-card flex flex-col gap-3 rounded-2xl p-6 text-card-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="size-5 text-brand-700" />
          <p className="font-display text-h4 tracking-tight">Walkthrough request received.</p>
        </div>
        <p className="text-small text-card-foreground/80">
          {submitted.notified
            ? `Logged for the ${submitted.segment} segment and forwarded to the team — a CARI Forge operator from ${submitted.organisation} will reply within 48 hours.`
            : `Logged. We're still in pilot — expect a slower reply from a named human while we set up the inbox for the ${submitted.segment} segment.`}
        </p>
        <p className="text-caption text-muted-foreground">
          Reference: <span className="font-mono text-card-foreground">{submitted.id}</span>
          {' · '}captured {submitted.createdAt.slice(0, 10)}
          {' · '}
          <span className="text-card-foreground">{submitted.fullName}</span>,{' '}
          <span className="text-brand-700">{submitted.organisation}</span> — {submitted.role} ·{' '}
          {submitted.segment}.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetForAnother}
          className="mt-2 self-start"
        >
          Submit another walkthrough
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="e.g. Dr Anna Lefevre" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="workEmail"
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
              <FormDescription>
                Used by the team to reply to your procurement-grade brief.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="organisation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organisation</FormLabel>
              <FormControl>
                <Input
                  autoComplete="organization"
                  placeholder="e.g. Bundesanstalt für Finanzdienstleistungsaufsicht"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
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
            name="segment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred segment</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a segment" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SEGMENT_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  The four pre-approved engagement segments plus an Other lane.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What problem do you want a council to look at?</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Two or three sentences: the regulation you are up against, the deadline, and the deliverable that an audit would need to read."
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                40–1200 characters. The chairman reads this verbatim before the council kicks off.
              </FormDescription>
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
          {form.formState.isSubmitting ? 'Sending…' : 'Request the walkthrough'}
        </Button>
      </form>
    </Form>
  );
}
