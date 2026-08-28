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
    return (
      <div className="glass-card flex flex-col gap-4 rounded-2xl p-6 text-card-foreground">
        <div className="flex flex-col gap-3">
          <p className="font-display text-h4 tracking-tight">Brief received.</p>
          <p className="text-small text-card-foreground/80">
            {submitted.notified
              ? "Logged and forwarded to the team — we'll reply from a named human within 48 hours."
              : "Logged. We're still in pilot — expect a slower reply while we set up the inbox."}
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
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-small font-medium text-foreground">What happens next</p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-small text-card-foreground/80">
            <li>A named human reads your brief — not an automated reply.</li>
            <li>
              If it looks like a fit for a 21-day proof, we reply
              {submitted.email ? ' to the email above' : ' and ask how to reach you'} to start
              Discovery.
            </li>
            <li>If it isn&rsquo;t a fit yet, we say so plainly and explain why.</li>
          </ol>
        </div>
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
