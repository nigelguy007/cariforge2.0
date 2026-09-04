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
// Document attachment: stored directly in Postgres (LeadAttachment.data,
// bytea) via POST /api/leads/[id]/attachment — no Vercel Blob/S3 needed at
// pilot scale. Uploaded AFTER the lead itself is created (the attachment
// route needs a real leadId to attach to). This is deliberately plain
// `fetch`, not apiFetch: apiFetch (framework-owned) hardcodes
// `content-type: application/json`, which is wrong for a multipart body —
// the browser needs to set its own boundary. A failed attachment upload
// never blocks or undoes the brief submission itself; the lead is captured
// either way and the user sees a clear warning if only the file failed.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
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
import { useSession } from '@/lib/auth-client';
import type { ConfiguratorResultT } from '@/lib/contracts/configurator';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  friendlyLeadReference,
  LeadCreate,
  LeadItem,
  MAX_ATTACHMENT_BYTES,
} from '@/lib/contracts/leads';
import { applyServerErrors } from '@/lib/forms';

// react-hook-form's resolver wants the INPUT shape (before the schema's
// transform). `z.input` is the pre-parse shape: brief required, email optional.
type FormValues = z.input<typeof LeadCreate>;

const MAX_ATTACHMENT_MB = Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024));

async function uploadAttachment(leadId: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.append('file', file);
  try {
    const res = await fetch(`/api/leads/${leadId}/attachment`, { method: 'POST', body });
    return res.ok;
  } catch {
    return false;
  }
}

// UX review C1: real user report — "does it have a section to register and
// log into the dashboard? this needs to be on the workflow." Signed-out
// visitors get a sign-up/log-in prompt naming the dashboard payoff
// (converting this exact brief once they're in); an already-signed-in
// visitor gets a direct link instead of a redundant sign-up pitch — the
// dashboard's own conversion card (BriefConversionCard) will show the
// brief there already.
function BriefDashboardCta() {
  const { data: session, isPending } = useSession();
  if (isPending) return null;
  if (session?.user) {
    return (
      <a
        href="/dashboard"
        className="glass-cta inline-flex w-fit items-center justify-center rounded-full px-4 py-2 text-small"
      >
        Track it in your dashboard
      </a>
    );
  }
  return (
    // Was `bg-brand-50` — same light-mode-only surface with no dark-mode
    // override found on /missions/new during 2026-09-04 testing ("a light
    // blue circle not visible"). Same fix: .glass-inset.
    <div className="glass-inset flex flex-col gap-2 p-4">
      {/* Real user feedback (2026-09-04): "what is start a governed
          mission instead, dont know what is happening here." This CTA
          used to name "a governed mission" with zero explanation — the
          first place a brand-new, not-yet-signed-up visitor could hit
          that term, before seeing any explanation of what it means. Said
          in plain terms instead; what "governed mission" actually names
          is explained later, at the point it's an actual choice
          (BriefConversionCard, once signed in). */}
      <p className="text-small text-foreground">
        Create an account and this brief will be waiting for you — track our reply, then decide
        whether to build it yourself or send it through a full review.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href="/signup"
          className="glass-cta inline-flex items-center justify-center rounded-full px-4 py-2 text-small"
        >
          Sign up
        </a>
        <a
          href="/login"
          className="glass-outline-cta inline-flex items-center justify-center rounded-full px-4 py-2 text-small"
        >
          Log in
        </a>
      </div>
    </div>
  );
}

// Real user feedback (2026-09-04): "it says unlikely fit - for now - this
// should state pending review instead." The automated read is real,
// useful signal (the AI classification underneath it doesn't change), but
// showing an unqualified verdict — "Unlikely fit" — the instant a brief is
// submitted reads as a final rejection before any human has looked at it.
// "Pending review" now leads every tier, with the automated read kept as a
// qualifier rather than dropped — nothing here is a real decision until
// Discovery's actual gate.
const FIT_STYLE: Record<ConfiguratorResultT['fit'], { label: string; className: string }> = {
  strong: { label: 'Pending review (strong fit)', className: 'bg-emerald-500/15 text-emerald-800' },
  possible: { label: 'Pending review (possible fit)', className: 'bg-amber-500/15 text-amber-800' },
  unlikely: { label: 'Pending review (fit unclear)', className: 'bg-rose-500/15 text-rose-800' },
};

// Product decision (2026-08-29): the front-door brief's first response is
// this — a fully-automated Discovery-agent read, no human in the loop
// before the visitor sees it. Reuses ConfiguratorResultT verbatim (same
// call the pre-signup workflow configurator already makes), so this is
// deliberately labeled the same honest way that contract already commits
// to: indicative and automated, not a binding gate ruling — the real
// Discovery gate still happens with a named human once this brief is
// converted into an actual governed mission (BriefDashboardCta below).
function DiscoveryTriageCard({ result }: { result: ConfiguratorResultT }) {
  const fit = FIT_STYLE[result.fit];
  return (
    // Was `rounded-xl border border-border bg-muted/30 p-4` — a flat,
    // hardcoded grey box, a different code path from .glass-card/.glass-inset
    // entirely, which is why it never picked up the dark-glass treatment
    // applied everywhere else. .glass-inset (custom-style.css) is the
    // purpose-built nested version — designed to sit inside the outer
    // .glass-card without compounding blur or doubling the corner glow.
    <div className="glass-inset flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-small font-medium text-foreground">Discovery&rsquo;s read</span>
        <span className={`rounded-full px-2 py-0.5 text-caption font-medium ${fit.className}`}>
          {fit.label}
        </span>
      </div>
      <p className="text-small text-card-foreground/80">{result.summary}</p>

      {result.agentFocus.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Where the seven agents would focus
          </p>
          <ul className="flex flex-col gap-1 text-small text-card-foreground/80">
            {result.agentFocus.map((f) => (
              <li key={f.agent}>
                <span className="font-medium text-foreground">{f.agent}:</span> {f.why}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.riskFlags.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Worth flagging
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-small text-card-foreground/80">
            {result.riskFlags.map((r, i) => (
              // Free-text agent output, no stable id — index key is safe:
              // this list is never reordered or edited client-side.
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.clarifyingQuestions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Questions before Discovery could rule on this for real
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-small text-card-foreground/80">
            {result.clarifyingQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-caption text-muted-foreground">
        Automated and indicative — not a binding ruling. Sign up to convert this brief into a real
        mission, where a named human gates every stage.
      </p>
    </div>
  );
}

export function BriefIntakeForm() {
  const [submitted, setSubmitted] = useState<LeadItem | null>(null);
  const [attachedFilename, setAttachedFilename] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(LeadCreate),
    defaultValues: { brief: '', email: '' },
  });

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = ''; // allow re-picking the same file after removing it
    if (!picked) return;
    if (picked.size > MAX_ATTACHMENT_BYTES) {
      setFileError(`That file is too large — cap is ${MAX_ATTACHMENT_MB} MB.`);
      return;
    }
    if (
      !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
        picked.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
      )
    ) {
      setFileError('PDF, Word, text, CSV, PNG, or JPEG only.');
      return;
    }
    setFileError(null);
    setFile(picked);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await apiFetch('/api/leads', {
        method: 'POST',
        body: JSON.stringify(values),
        schema: LeadItem,
      });
      if (file) {
        const ok = await uploadAttachment(created.id, file);
        if (ok) {
          setAttachedFilename(file.name);
        } else {
          toast.error(
            'Your brief was saved, but the attachment failed to upload. You can email it instead.',
          );
        }
      }
      setSubmitted(created);
    } catch (err) {
      const applied = err instanceof Error && applyServerErrors(err.cause, form.setError);
      if (!applied) toast.error('Could not save your brief. Please try again.');
    }
  });

  if (submitted) {
    const reference = friendlyLeadReference(submitted.id);
    const triage = submitted.triage;
    return (
      <div className="glass-card flex flex-col gap-4 rounded-2xl p-6 text-card-foreground">
        <div className="flex flex-col gap-3">
          <p className="font-display text-h4 tracking-tight">Brief received.</p>
          <p className="text-small text-card-foreground/80">
            {triage?.status === 'ok'
              ? 'Logged, and the Discovery agent has already read it — its take is below.'
              : "Logged. We couldn't run Discovery's automated read just now — a named human will follow up within 48 hours instead."}
          </p>
          <p className="text-caption text-muted-foreground">
            Reference: <span className="font-mono text-card-foreground">{reference}</span>
            {' · '}captured {submitted.createdAt.slice(0, 10)}. Quote this reference in any
            follow-up email.
          </p>
          {attachedFilename ? (
            <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <Paperclip className="size-3" aria-hidden="true" />
              Attached: {attachedFilename}
            </p>
          ) : null}
        </div>

        {triage?.status === 'ok' ? (
          <DiscoveryTriageCard result={triage.result} />
        ) : (
          <div className="glass-inset flex flex-col gap-2 p-4">
            <p className="text-small font-medium text-foreground">What happens next</p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-small text-card-foreground/80">
              <li>A named human reads your brief.</li>
              <li>
                If it looks like a fit for a 21-day proof, we reply
                {submitted.email ? ' to the email above' : ' and ask how to reach you'} to start
                Discovery.
              </li>
              <li>If it isn&rsquo;t a fit yet, we say so plainly and explain why.</li>
            </ol>
          </div>
        )}

        {/* UX review C1: close the loop the reference number used to leave
            open — an account is how this brief actually gets tracked and
            converted into a governed mission, so the workflow says so here,
            not just after the visitor happens to find /signup on their own. */}
        <BriefDashboardCta />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
          <a href="#council" className="font-medium text-primary underline underline-offset-4">
            See how The Oracles rule on it
          </a>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <a href="/" className="font-medium text-primary underline underline-offset-4">
            Back to homepage
          </a>
        </div>
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
                  className="placeholder:text-xs placeholder:italic placeholder:leading-normal"
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
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Attach a document"
          />
          {file ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-small">
              <span className="flex items-center gap-2 truncate text-foreground">
                <Paperclip className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-caption text-muted-foreground">
                  ({Math.ceil(file.size / 1024)} KB)
                </span>
              </span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Remove attachment"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-small text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Paperclip className="size-4" aria-hidden="true" />
              Choose a file — PDF, Word, text, CSV, PNG, or JPEG, up to {MAX_ATTACHMENT_MB} MB
            </button>
          )}
          {fileError ? <p className="text-caption text-destructive">{fileError}</p> : null}
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
