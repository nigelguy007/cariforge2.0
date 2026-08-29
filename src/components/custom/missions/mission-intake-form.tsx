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

// Revisited per explicit feedback: a permanent pale-blue background read
// as messy with 8+ boxes tinted at once, and wasn't a "standard" pattern.
// Consulted the ui-ux-pro-max skill's guidance (semantic tokens over
// ad-hoc color; forms §8) and used the actual standard convention instead
// — a neutral input at rest, with a clear colored ring only on focus
// (the same pattern Linear/Stripe/GitHub use, and the base Input/Textarea
// already do faintly via focus-visible:ring-ring — this just makes it
// unmistakable rather than inventing a new resting-state color).
const INPUT_HIGHLIGHT = 'focus-visible:ring-2 focus-visible:border-ring';

// Field-level content revisited per direct feedback ("does not give
// instructions of what's needed") using the form-cro skill's guidance on
// labels vs. placeholders vs. help text — but NOT its field-reduction
// advice: this isn't a lead-gen form, it's a governance intake that a real
// pipeline stage reads, so cutting fields down would undermine the
// product's actual job. Each field now has:
//   - `description`: what's being asked AND which stage/agent reads it —
//     ties the field back to the page's actual purpose instead of leaving
//     it as an abstract label.
//   - `placeholder`: a genuine worked example (the form-cro rule
//     "placeholders are examples, not labels" — this repo's own hint text
//     was being reused as the placeholder, which is a label restated, not
//     an example of a real answer).
// Grouped into three sections matching the pipeline stages that actually
// consume them (see docs/app_spec.md-equivalent domain knowledge from
// how-it-works: Discovery / Readiness+Governance / the final gate) rather
// than one undifferentiated 8-field grid.
const INTAKE_GROUPS = [
  {
    id: 'the-ask',
    title: 'The ask',
    blurb: 'What Discovery turns into a testable problem statement before anything else runs.',
    fields: [
      {
        name: 'need',
        label: 'Need',
        description: "The gap in plain business terms — what's missing today, for whom.",
        example:
          'A compliance team of six manually checks each claim against EU AI Act Article 14 disclosure requirements — nothing flags a missing disclosure before it reaches a regulator.',
      },
      {
        name: 'intendedOutcome',
        label: 'Intended outcome',
        description:
          "What 'solved' looks like in terms a human could actually verify happened. Feeds the acceptance criteria below too.",
        example:
          'Every incoming claim is automatically checked for required disclosures and routed to the correct reviewer within one business day, with zero missed Article 14 disclosures.',
      },
      {
        name: 'constraints',
        label: 'Constraints',
        description:
          'Hard limits the build must respect — budget, deadline, regulatory regime, headcount available to review it.',
        example:
          'Must ship before 2 August 2026 (the Article 14 deadline). No new hires — the existing 6-person team reviews flagged claims. EU-only data residency.',
      },
    ],
  },
  {
    id: 'governed-by',
    title: 'What governs it',
    blurb: 'What Readiness audits and Governance locks into the case file before code is written.',
    fields: [
      {
        name: 'authorityBoundary',
        label: 'Authority boundary',
        description: 'Who can approve a gate, and who must be consulted first.',
        example:
          'Head of Compliance approves each gate. Legal must sign off before Governance clears. No decision is final without a named human reviewer.',
      },
      {
        name: 'dataClassification',
        label: 'Data classification',
        description:
          'What kind of data this touches. Readiness locks a data-minimisation clause in the case file based on this.',
        example:
          'Personal data (claimant names, policy numbers) and regulated financial data. No health data. Subject to GDPR and EU AI Act Article 14.',
      },
      {
        name: 'retentionPolicy',
        label: 'Retention policy',
        description:
          "How long evidence and audit records are kept, and where. Governance's audit trail and hash chain are built around this.",
        example:
          'Audit records retained 7 years per regulatory requirement, stored in the EU region only, immutable once written.',
      },
    ],
  },
  {
    id: 'definition-of-done',
    title: 'Definition of done',
    blurb: "What the final Software Build gate is actually scored against — not a feeling, a test.",
    fields: [
      {
        name: 'acceptanceCriteria',
        label: 'Acceptance criteria',
        description: 'Observable, checkable signals that prove the outcome happened.',
        example:
          '100% of test claims correctly flagged for missing disclosures; average routing time under 4 business hours; zero false negatives on a 200-claim regression set.',
      },
      {
        name: 'nonGoals',
        label: 'Explicit non-goals',
        description:
          "What this mission is deliberately NOT doing — the scope boundary that keeps a 21-day proof bounded, not something growing quietly into a bigger build.",
        example:
          "Not replacing the claims system of record. Not automating the reviewer's final decision. Not covering non-EU jurisdictions in this proof.",
      },
    ],
  },
] as const;

export function MissionIntakeForm({
  initialIntake = '',
  // UX review C1: Lead id when this intake converts a public brief —
  // carried through to MissionCreate so the CF reference stays on the
  // mission. The server re-verifies the lead belongs to this account.
  sourceLeadId,
}: {
  initialIntake?: string;
  sourceLeadId?: string;
}) {
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
          sourceLeadId,
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
      <form onSubmit={onSubmit} className="glass-card space-y-8 rounded-2xl p-6">
        <FormField
          control={form.control}
          name="intake"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Plain-English need (lead paragraph)</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} className={INPUT_HIGHLIGHT} />
              </FormControl>
              <FormDescription className="text-caption text-muted-foreground">
                One paragraph, as you&rsquo;d explain it to a colleague — what outcome you need
                and what&rsquo;s blocking it today. The nine fields below break this down further.
                <br />
                <span className="italic">
                  e.g. &ldquo;We need to triage claims documents against EU AI Act Article 14
                  before 2 August 2026. Today a team of six does this by hand in a shared inbox —
                  we need something that reads each claim, flags the ones missing required
                  disclosures, and routes them to the right reviewer.&rdquo;
                </span>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Mission name (optional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder="e.g. Replace legacy CRM with regulatory reporting support"
                  className={INPUT_HIGHLIGHT}
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
            <FormItem className="space-y-3">
              <FormLabel>Normalized need (optional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder="Replace CRM v3 with a regulated multi-jurisdiction system"
                  className={INPUT_HIGHLIGHT}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <fieldset className="space-y-8 rounded-xl border border-border/60 p-6">
          <legend>
            <span className="text-eyebrow text-brand-700">Nine attribution fields</span>
          </legend>
          <p className="text-small text-muted-foreground">
            Each field below is required and bounded to 2000 characters. This isn&rsquo;t
            paperwork — it&rsquo;s the testable problem statement Discovery works from, and what
            Readiness and Governance check before a line of code is written. A thin answer here
            comes back as a returned gate later, not a shortcut now.
          </p>
          {INTAKE_GROUPS.map((group) => (
            <div key={group.id} className="space-y-4">
              <div>
                <h4 className="text-small font-semibold text-foreground">{group.title}</h4>
                <p className="text-caption text-muted-foreground">{group.blurb}</p>
              </div>
              <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
                {group.fields.map(({ name, label, description, example }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={`intakeStructured.${name}` as never}
                    render={({ field }) => (
                      // Real feedback: pre-filling every box with a full example
                      // paragraph as placeholder text read as messy — 8 boxes of
                      // grey example text at once. Left genuinely blank now; the
                      // example moved into the description below instead of
                      // inside the input, per "leave it blank where writing is
                      // expected."
                      <FormItem className="space-y-3">
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            value={(field.value as string | undefined) ?? ''}
                            className={INPUT_HIGHLIGHT}
                          />
                        </FormControl>
                        <FormDescription className="text-caption text-muted-foreground">
                          {description}
                          <br />
                          <span className="italic">e.g. &ldquo;{example}&rdquo;</span>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
          <FormField
            control={form.control}
            name="intakeStructured.missionOwner"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Mission owner (optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={(field.value as string | undefined) ?? ''}
                    placeholder="Name or role of the mission owner"
                    className={INPUT_HIGHLIGHT}
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
          <div className="space-y-3">
            <Label htmlFor="missing">Unknown facts (one per line)</Label>
            <Textarea
              id="missing"
              rows={3}
              value={missingRaw}
              onChange={(e) => setMissingRaw(e.target.value)}
              className={INPUT_HIGHLIGHT}
            />
            <p className="text-caption italic text-muted-foreground">
              e.g. &ldquo;Realistic per-claim volume&rdquo;, &ldquo;Regulator named
              contact&rdquo;, &ldquo;Vendor shortlist&rdquo;
            </p>
          </div>
        </fieldset>

        <div className="space-y-3">
          <Label htmlFor="tags">Domain tags (comma-separated)</Label>
          <Input
            id="tags"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="financial-services, compliance, procurement"
            className={INPUT_HIGHLIGHT}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Contact email (optional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  type="email"
                  placeholder="you@company.com"
                  className={INPUT_HIGHLIGHT}
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
