// @polsia:user-owned — chat-based project intake. Replaces the static
// MissionIntakeForm as the default "Start a project" flow: gathers the same
// nine MissionIntakeStructure fields through natural conversation instead of
// a big form, then submits the exact same MissionCreate payload the form
// always sent. MissionIntakeForm itself is untouched and still exists as a
// manual fallback.
//
// Document attachment: no mission exists yet during the conversation (unlike
// a Lead, which exists from the first POST), so files are held client-side
// through the whole chat (multiple, of any allowed document/image/video
// type) and uploaded one by one only once onStartProject actually creates
// the mission — each POSTed to that mission's own evidence endpoint
// (/api/forge/missions/[id]/evidence, extended to accept a real file the
// same way POST /api/leads/[id]/attachment does; see that route). Same MIME
// allowlist/size cap and the same plain `fetch`-with-`FormData` pattern
// brief-intake-form.tsx uses for its own attachment (not apiFetch, which
// hardcodes `content-type: application/json` — wrong for multipart). A
// failed attachment upload never blocks or undoes starting the project.

'use client';

import { Paperclip, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { MissionCreate, MissionDetail } from '@/lib/contracts/forge';
import {
  type IntakeChatMessageT,
  IntakeChatResponse,
  type IntakeChatResponseT,
} from '@/lib/contracts/intake-chat';
import { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_BYTES } from '@/lib/contracts/leads';

const MAX_ATTACHMENT_MB = Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024));

async function uploadEvidenceFile(missionId: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.append('file', file);
  try {
    const res = await fetch(`/api/forge/missions/${missionId}/evidence`, {
      method: 'POST',
      body,
    });
    return res.ok;
  } catch {
    return false;
  }
}

const ATTACHMENT_TYPES_LABEL = 'PDF, Word, text, CSV, image, or video';

const OPENING_MESSAGE =
  "Hi, I'm CariForge. Tell me about the business problem you're trying to solve — " +
  "in your own words, no need to structure it. What's not working today, and for whom?";

// Labels reused verbatim from mission-intake-form.tsx's INTAKE_GROUPS, so the
// confirmation summary reads the same as the old form's field labels.
const FIELD_LABELS: ReadonlyArray<{ key: keyof IntakeChatResponseT; label: string }> = [
  { key: 'need', label: 'Need' },
  { key: 'intendedOutcome', label: 'Intended outcome' },
  { key: 'constraints', label: 'Constraints' },
  { key: 'authorityBoundary', label: 'Authority boundary' },
  { key: 'dataClassification', label: 'Data classification' },
  { key: 'retentionPolicy', label: 'Retention policy' },
  { key: 'acceptanceCriteria', label: 'Acceptance criteria' },
  { key: 'nonGoals', label: 'Explicit non-goals' },
];

export function MissionIntakeChat({
  initialIntake = '',
  // UX review C1 (mirrors mission-intake-form.tsx): Lead id when this intake
  // converts a public brief — carried through to the final MissionCreate
  // call so the CF reference stays on the mission.
  sourceLeadId,
}: {
  initialIntake?: string;
  sourceLeadId?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<IntakeChatMessageT[]>([
    { role: 'assistant', content: OPENING_MESSAGE },
  ]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [extraction, setExtraction] = React.useState<IntakeChatResponseT | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const seededRef = React.useRef(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = ''; // allow re-picking the same file after removing it
    // The native file-picker dialog steals focus from the chat textarea;
    // hand it back so typing immediately after choosing files keeps working.
    textareaRef.current?.focus();
    if (picked.length === 0) return;
    const accepted: File[] = [];
    let error: string | null = null;
    for (const candidate of picked) {
      if (candidate.size > MAX_ATTACHMENT_BYTES) {
        error = `"${candidate.name}" is too large — cap is ${MAX_ATTACHMENT_MB} MB per file.`;
        continue;
      }
      if (
        !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
          candidate.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
        )
      ) {
        error = `"${candidate.name}" isn't a supported type — ${ATTACHMENT_TYPES_LABEL} only.`;
        continue;
      }
      accepted.push(candidate);
    }
    setFileError(error);
    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted]);
    }
  }

  const sendTurn = React.useCallback(async (nextMessages: IntakeChatMessageT[]) => {
    setSending(true);
    try {
      const response = await apiFetch('/api/forge/intake-chat', {
        method: 'POST',
        body: JSON.stringify({ messages: nextMessages }),
        schema: IntakeChatResponse,
      });
      setMessages([...nextMessages, { role: 'assistant', content: response.reply }]);
      setExtraction(response);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'CariForge could not continue the conversation'));
    } finally {
      setSending(false);
    }
  }, []);

  // The dashboard's quick-capture handoff (?intake=) — preserved from the
  // old form's `initialIntake` prop, but here it becomes the first thing the
  // person "says" rather than pre-filled textarea content.
  React.useEffect(() => {
    if (seededRef.current || !initialIntake.trim()) return;
    seededRef.current = true;
    const seeded: IntakeChatMessageT[] = [
      { role: 'assistant', content: OPENING_MESSAGE },
      { role: 'user', content: initialIntake.trim() },
    ];
    setMessages(seeded);
    void sendTurn(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIntake]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  const onSend = () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: IntakeChatMessageT[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    void sendTurn(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const onStartProject = async () => {
    if (!extraction) return;
    setStarting(true);
    try {
      const parsed = MissionCreate.parse({
        intake: extraction.intake,
        name: extraction.projectName || undefined,
        normalizedNeed: '',
        intakeStructured: {
          need: extraction.need,
          intendedOutcome: extraction.intendedOutcome,
          constraints: extraction.constraints,
          authorityBoundary: extraction.authorityBoundary,
          dataClassification: extraction.dataClassification,
          retentionPolicy: extraction.retentionPolicy,
          acceptanceCriteria: extraction.acceptanceCriteria,
          nonGoals: extraction.nonGoals,
          missionOwner: extraction.missionOwner || undefined,
        },
        missingInformation: extraction.missingInformation,
        domainTags: [],
        sourceLeadId,
      });
      const detail = await apiFetch('/api/forge/missions', {
        method: 'POST',
        body: JSON.stringify(parsed),
        schema: MissionDetail,
      });
      if (files.length > 0) {
        const results = await Promise.all(
          files.map((f) => uploadEvidenceFile(detail.mission.id, f)),
        );
        const failedCount = results.filter((ok) => !ok).length;
        if (failedCount > 0) {
          toast.error(
            failedCount === files.length
              ? 'Your project was started, but the attachments failed to upload. You can attach them from the project page instead.'
              : `Your project was started, but ${failedCount} of ${files.length} attachments failed to upload. You can attach the rest from the project page.`,
          );
        }
      }
      toast.success('Project started');
      router.push(`/missions/${detail.mission.slug}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not start the project'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="app-panel flex h-[32rem] flex-col overflow-hidden">
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[85%] rounded-[var(--app-radius-sm)] border border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] px-3.5 py-2.5'
                  : 'mr-auto max-w-[85%] rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)] px-3.5 py-2.5'
              }
            >
              <p className="app-body whitespace-pre-wrap text-[var(--app-text)]">{m.content}</p>
            </div>
          ))}
          {sending ? (
            <div className="mr-auto max-w-[85%] rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)] px-3.5 py-2.5">
              <p className="app-small italic text-[var(--app-text-muted)]">
                CariForge is thinking…
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex items-end gap-2 border-t border-[var(--app-border)] p-3 sm:p-4">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Type your answer…"
            disabled={sending}
            className="min-h-11 resize-none"
          />
          <Button
            type="button"
            onClick={onSend}
            disabled={sending || !input.trim()}
            className="min-h-11"
          >
            Send
          </Button>
        </div>
      </div>

      <div className="app-panel space-y-1.5 p-4 sm:p-5">
        <span className="app-small font-medium text-[var(--app-text)]">
          Attach documents, images, or videos{' '}
          <span className="font-normal text-[var(--app-text-muted)]">(optional)</span>
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={handleFileChange}
          aria-label="Attach documents, images, or videos"
        />
        {files.length > 0 ? (
          <ul className="space-y-1.5">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${f.lastModified}-${i}`}
                className="flex items-center justify-between gap-2 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3.5 py-2.5"
              >
                <span className="app-small flex items-center gap-2 truncate text-[var(--app-text)]">
                  <Paperclip className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{f.name}</span>
                  <span className="app-caption shrink-0 text-[var(--app-text-muted)]">
                    ({Math.ceil(f.size / 1024)} KB)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="app-small flex items-center justify-center gap-2 rounded-[var(--app-radius-sm)] border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3.5 py-2.5 text-[var(--app-text-muted)] transition-colors hover:border-[var(--app-accent-border)] hover:text-[var(--app-text)]"
        >
          <Paperclip className="size-4" aria-hidden="true" />
          {files.length > 0 ? 'Add another file' : 'Choose files'} — {ATTACHMENT_TYPES_LABEL}, up to{' '}
          {MAX_ATTACHMENT_MB} MB each
        </button>
        {fileError ? <p className="app-caption text-destructive">{fileError}</p> : null}
      </div>

      {extraction?.readyToSubmit ? (
        <div className="app-panel space-y-4 p-5 sm:p-6">
          <div>
            <h3 className="app-h3 text-[var(--app-text)]">Ready to start</h3>
            <p className="app-small mt-1 text-[var(--app-text-muted)]">
              Here&rsquo;s what CariForge gathered from the conversation. Keep chatting above if
              anything needs a change, or start the project now.
            </p>
          </div>
          {extraction.projectName ? (
            <p className="app-body text-[var(--app-text)]">
              <span className="font-medium">Project name:</span> {extraction.projectName}
            </p>
          ) : null}
          <dl className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {FIELD_LABELS.map(({ key, label }) => (
              <div key={key}>
                <dt className="app-small font-medium text-[var(--app-text)]">{label}</dt>
                <dd className="app-small mt-0.5 whitespace-pre-wrap text-[var(--app-text-muted)]">
                  {String(extraction[key])}
                </dd>
              </div>
            ))}
          </dl>
          {extraction.missionOwner ? (
            <p className="app-small text-[var(--app-text)]">
              <span className="font-medium">Project owner:</span> {extraction.missionOwner}
            </p>
          ) : null}
          {extraction.missingInformation.length > 0 ? (
            <div>
              <p className="app-small font-medium text-[var(--app-text)]">Still unknown</p>
              <ul className="app-small mt-1 list-inside list-disc text-[var(--app-text-muted)]">
                {extraction.missingInformation.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button type="button" onClick={onStartProject} disabled={starting} className="min-h-11">
            {starting ? 'Starting…' : 'Start this project'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
