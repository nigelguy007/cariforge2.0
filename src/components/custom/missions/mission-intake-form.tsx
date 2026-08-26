// @polsia:user-owned — Mission intake form: captures the nine attribution
// fields required by the brief (need, intended outcome, constraints,
// authority boundary, data classification, retention, acceptance criteria,
// explicit non-goals) plus optional missing-information capture.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { MissionCreate, MissionDetail, MissionIntakeStructure } from '@/lib/contracts/forge';
import { applyServerErrors } from '@/lib/forms';

const INTAKE_FIELDS = [
  { name: 'need', label: 'Need', hint: 'Plain-English statement of what is missing.' },
  { name: 'intendedOutcome', label: 'Intended outcome', hint: 'What success looks like.' },
  { name: 'constraints', label: 'Constraints', hint: 'Budget, regulatory, time, staffing limits.' },
  {
    name: 'authorityBoundary',
    label: 'Authority boundary',
    hint: 'Who can decide, who must agree.',
  },
  {
    name: 'dataClassification',
    label: 'Data classification',
    hint: 'Personal data? regulated data? commercial sensitive?',
  },
  {
    name: 'retentionPolicy',
    label: 'Retention policy',
    hint: 'How long evidence is retained and where.',
  },
  {
    name: 'acceptanceCriteria',
    label: 'Acceptance criteria',
    hint: 'Observable signals that prove the outcome.',
  },
  { name: 'nonGoals', label: 'Explicit non-goals', hint: 'What we are NOT doing.' },
] as const;

export function MissionIntakeForm({ initialIntake = '' }: { initialIntake?: string }) {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(MissionCreate),
    defaultValues: {
      intake: initialIntake,
      name: '',
      normalizedNeed: '',
      domainTags: [] as string[],
      email: '',
      intakeStructured: {
        need: '',
        intendedOutcome: '',
        constraints: '',
        authorityBoundary: '',
        dataClassification: '',
        retentionPolicy: '',
        acceptanceCriteria: '',
        nonGoals: '',
        missionOwner: '',
      },
      missingInformation: [] as string[],
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // Validate the structured intake separately so field-level errors stay
      // bucketed under intakeStructured.*.
      const structured = MissionIntakeStructure.safeParse(values.intakeStructured);
      if (!structured.success) {
        for (const [field, messages] of Object.entries(structured.error.flatten().fieldErrors)) {
          for (const message of messages ?? []) {
            form.setError(`intakeStructured.${field}` as never, { type: 'server', message });
          }
        }
        return;
      }
      const detail = await apiFetch('/api/forge/missions', {
        method: 'POST',
        body: JSON.stringify({
          intake: values.intake,
          name: values.name,
          normalizedNeed: values.normalizedNeed,
          intakeStructured: structured.data,
          missingInformation: values.missingInformation,
          domainTags: values.domainTags,
          email: values.email,
        }),
        schema: MissionDetail,
      });
      toast.success('Mission created');
      router.push(`/missions/${detail.mission.slug}`);
    } catch (err) {
      const message = (err as Error).message ?? 'Could not create mission';
      const cause = (err as { cause?: { errors?: Record<string, string> } }).cause;
      if (cause?.errors) {
        if (!applyServerErrors(cause, form.setError)) {
          toast.error(message);
        }
        return;
      }
      toast.error(message);
    }
  });

  const [tagsRaw, setTagsRaw] = React.useState('');
  const [missingRaw, setMissingRaw] = React.useState('');
  React.useEffect(() => {
    form.setValue(
      'domainTags',
      tagsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }, [tagsRaw, form]);

  React.useEffect(() => {
    form.setValue(
      'missingInformation',
      missingRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }, [missingRaw, form]);

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="glass-card space-y-6 rounded-2xl p-6">
        <FormField
          control={form.control}
          name="intake"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plain-English need (lead paragraph)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={4}
                  placeholder="Describe the need as you would to a colleague. One paragraph: what outcome you need and what is blocking it."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mission name (optional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder="e.g. Replace legacy CRM with regulatory reporting support"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="normalizedNeed"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Normalized need (optional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder="Replace CRM v3 with a regulated multi-jurisdiction system"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <fieldset className="space-y-4 rounded-xl border border-border/60 p-4">
          <legend>
            <span className="text-eyebrow text-brand-700">Nine attribution fields</span>
          </legend>
          <p className="text-small text-muted-foreground">
            Each of the following fields is required and bounded to 2000 characters. The forge uses
            these to surface missing-information for the next stage.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {INTAKE_FIELDS.map(({ name, label, hint }) => (
              <FormField
                key={name}
                control={form.control}
                name={`intakeStructured.${name}` as never}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        value={(field.value as string | undefined) ?? ''}
                        placeholder={hint}
                      />
                    </FormControl>
                    <FormDescription className="text-caption text-muted-foreground">
                      {hint}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormField
            control={form.control}
            name="intakeStructured.missionOwner"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mission owner (optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={(field.value as string | undefined) ?? ''}
                    placeholder="Name or role of the mission owner"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-border/60 p-4">
          <legend>
            <span className="text-eyebrow text-brand-700">Missing information</span>
          </legend>
          <p className="text-small text-muted-foreground">
            Note anything still unknown that the forge should surface to you before work proceeds.
          </p>
          <Label htmlFor="missing">Unknown facts (one per line)</Label>
          <Textarea
            id="missing"
            rows={3}
            value={missingRaw}
            onChange={(e) => setMissingRaw(e.target.value)}
            placeholder={'Realistic per-claim volume\nRegulator named contact\nVendor shortlist'}
          />
        </fieldset>

        <div>
          <Label htmlFor="tags">Domain tags (comma-separated)</Label>
          <Input
            id="tags"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="financial-services, compliance, procurement"
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact email (optional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  type="email"
                  placeholder="you@company.com"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="glass-cta" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Creating…' : 'Create mission'}
        </Button>
      </form>
    </Form>
  );
}
